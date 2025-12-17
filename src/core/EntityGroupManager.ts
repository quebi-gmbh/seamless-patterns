import type { Canvas } from 'fabric'
import type { ExtendedFabricObject, EntityGroup } from '../types/FabricExtensions'
import type { SerializedEntityGroup } from '../types/ProjectFormat'
import type { LayerManager } from './LayerManager'
import { generateUniqueId } from '../utils/idGenerator'

export class EntityGroupManager {
  private canvas: Canvas
  private layerManager: LayerManager
  private groups: Map<string, EntityGroup> = new Map()

  constructor(canvas: Canvas, layerManager: LayerManager) {
    this.canvas = canvas
    this.layerManager = layerManager
  }

  /**
   * Create a new entity group from multiple mirror group IDs
   */
  createGroup(mirrorGroupIds: string[], name?: string): EntityGroup | null {
    if (mirrorGroupIds.length < 2) {
      console.warn('Cannot create group with less than 2 entities')
      return null
    }

    // Get all objects to validate they exist and are on the same layer
    const allObjects: ExtendedFabricObject[] = []
    let commonLayerId: string | undefined

    for (const mirrorGroupId of mirrorGroupIds) {
      const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      if (objects.length === 0) {
        console.warn(`Mirror group ${mirrorGroupId} not found`)
        return null
      }

      const layerId = objects[0].layerId
      if (commonLayerId === undefined) {
        commonLayerId = layerId
      } else if (commonLayerId !== layerId) {
        console.warn('Cannot group entities from different layers')
        return null
      }

      // Check if any of these objects are already in a group
      const existingGroupId = objects[0].tiledMetadata?.entityGroupId
      if (existingGroupId) {
        console.warn(`Entity ${mirrorGroupId} is already in a group`)
        return null
      }

      allObjects.push(...objects)
    }

    if (!commonLayerId) {
      return null
    }

    // Create the group
    const groupId = generateUniqueId('entityGroup')
    const group: EntityGroup = {
      id: groupId,
      name: name || `Group ${this.groups.size + 1}`,
      memberMirrorGroupIds: [...mirrorGroupIds],
      layerId: commonLayerId,
    }

    this.groups.set(groupId, group)

    // Update all member objects with the group ID
    allObjects.forEach((obj) => {
      if (obj.tiledMetadata) {
        obj.tiledMetadata.entityGroupId = groupId
      }
    })

    // Consolidate z-index: bring all group members adjacent in z-order
    this.consolidateZIndex(mirrorGroupIds)

    this.canvas.requestRenderAll()
    return group
  }

  /**
   * Ungroup an entity group
   */
  ungroup(groupId: string): string[] {
    const group = this.groups.get(groupId)
    if (!group) {
      return []
    }

    const memberIds = [...group.memberMirrorGroupIds]

    // Remove group reference from all member objects
    memberIds.forEach((mirrorGroupId) => {
      const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      objects.forEach((obj) => {
        if (obj.tiledMetadata) {
          obj.tiledMetadata.entityGroupId = undefined
        }
      })
    })

    this.groups.delete(groupId)
    this.canvas.requestRenderAll()
    return memberIds
  }

  /**
   * Get a group by ID
   */
  getGroup(groupId: string): EntityGroup | undefined {
    return this.groups.get(groupId)
  }

  /**
   * Get the group that contains a specific mirror group
   */
  getGroupByMirrorGroupId(mirrorGroupId: string): EntityGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.memberMirrorGroupIds.includes(mirrorGroupId)) {
        return group
      }
    }
    return undefined
  }

  /**
   * Get all fabric objects that are members of a group
   */
  getGroupMembers(groupId: string): ExtendedFabricObject[] {
    const group = this.groups.get(groupId)
    if (!group) {
      return []
    }

    const members: ExtendedFabricObject[] = []
    group.memberMirrorGroupIds.forEach((mirrorGroupId) => {
      const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      members.push(...objects)
    })
    return members
  }

  /**
   * Get center-tile objects only for a group (one per mirror group)
   */
  getGroupCenterTileMembers(groupId: string): ExtendedFabricObject[] {
    const group = this.groups.get(groupId)
    if (!group) {
      return []
    }

    const members: ExtendedFabricObject[] = []
    group.memberMirrorGroupIds.forEach((mirrorGroupId) => {
      const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      const centerTile = objects.find(
        (obj) =>
          obj.tiledMetadata?.tilePosition[0] === 0 &&
          obj.tiledMetadata?.tilePosition[1] === 0
      )
      if (centerTile) {
        members.push(centerTile)
      }
    })
    return members
  }

  /**
   * Get all entity groups
   */
  getAllGroups(): EntityGroup[] {
    return Array.from(this.groups.values())
  }

  /**
   * Delete an entity group (optionally delete the member entities too)
   */
  deleteGroup(groupId: string, deleteMembers: boolean = false): void {
    const group = this.groups.get(groupId)
    if (!group) {
      return
    }

    if (deleteMembers) {
      group.memberMirrorGroupIds.forEach((mirrorGroupId) => {
        this.layerManager.deleteMirrorGroup(mirrorGroupId)
      })
    } else {
      // Just ungroup, don't delete members
      this.ungroup(groupId)
    }

    this.groups.delete(groupId)
  }

  /**
   * Remove a single entity from a group
   */
  removeFromGroup(groupId: string, mirrorGroupId: string): void {
    const group = this.groups.get(groupId)
    if (!group) {
      return
    }

    const index = group.memberMirrorGroupIds.indexOf(mirrorGroupId)
    if (index === -1) {
      return
    }

    // Remove group reference from the entity's objects
    const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
    objects.forEach((obj) => {
      if (obj.tiledMetadata) {
        obj.tiledMetadata.entityGroupId = undefined
      }
    })

    group.memberMirrorGroupIds.splice(index, 1)

    // If only one member remains, dissolve the group
    if (group.memberMirrorGroupIds.length < 2) {
      this.ungroup(groupId)
    }

    this.canvas.requestRenderAll()
  }

  /**
   * Add an entity to an existing group
   */
  addToGroup(groupId: string, mirrorGroupId: string): boolean {
    const group = this.groups.get(groupId)
    if (!group) {
      return false
    }

    const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
    if (objects.length === 0) {
      return false
    }

    // Verify same layer
    if (objects[0].layerId !== group.layerId) {
      console.warn('Cannot add entity from different layer to group')
      return false
    }

    // Check if already in a group
    if (objects[0].tiledMetadata?.entityGroupId) {
      console.warn('Entity is already in a group')
      return false
    }

    group.memberMirrorGroupIds.push(mirrorGroupId)

    // Update all objects with the group ID
    objects.forEach((obj) => {
      if (obj.tiledMetadata) {
        obj.tiledMetadata.entityGroupId = groupId
      }
    })

    this.canvas.requestRenderAll()
    return true
  }

  /**
   * Calculate the bounding box of a group (center tile objects only)
   */
  getGroupBounds(groupId: string): {
    left: number
    top: number
    width: number
    height: number
    centerX: number
    centerY: number
  } | null {
    const centerTileMembers = this.getGroupCenterTileMembers(groupId)
    if (centerTileMembers.length === 0) {
      return null
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    centerTileMembers.forEach((obj) => {
      const bounds = obj.getBoundingRect()
      minX = Math.min(minX, bounds.left)
      minY = Math.min(minY, bounds.top)
      maxX = Math.max(maxX, bounds.left + bounds.width)
      maxY = Math.max(maxY, bounds.top + bounds.height)
    })

    const width = maxX - minX
    const height = maxY - minY

    return {
      left: minX,
      top: minY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2,
    }
  }

  /**
   * Consolidate z-index of group members to be adjacent
   */
  private consolidateZIndex(mirrorGroupIds: string[]): void {
    // Find the highest z-index among all members
    let maxZIndex = -1
    const allObjects = this.canvas.getObjects()

    mirrorGroupIds.forEach((mirrorGroupId) => {
      const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      objects.forEach((obj) => {
        const index = allObjects.indexOf(obj)
        if (index > maxZIndex) {
          maxZIndex = index
        }
      })
    })

    // Bring all group members to front (they'll end up adjacent)
    mirrorGroupIds.forEach((mirrorGroupId) => {
      this.layerManager.bringMirrorGroupToFront(mirrorGroupId)
    })
  }

  /**
   * Serialize all groups for export
   */
  serialize(): SerializedEntityGroup[] {
    return Array.from(this.groups.values()).map((group) => ({
      id: group.id,
      name: group.name,
      memberMirrorGroupIds: [...group.memberMirrorGroupIds],
      layerId: group.layerId,
    }))
  }

  /**
   * Deserialize and restore groups from imported data
   */
  deserialize(groupsData: SerializedEntityGroup[]): void {
    this.groups.clear()

    groupsData.forEach((groupData) => {
      const group: EntityGroup = {
        id: groupData.id,
        name: groupData.name,
        memberMirrorGroupIds: [...groupData.memberMirrorGroupIds],
        layerId: groupData.layerId,
      }
      this.groups.set(group.id, group)

      // Update all member objects with the group ID
      group.memberMirrorGroupIds.forEach((mirrorGroupId) => {
        const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
        objects.forEach((obj) => {
          if (obj.tiledMetadata) {
            obj.tiledMetadata.entityGroupId = group.id
          }
        })
      })
    })
  }

  /**
   * Clear all groups
   */
  clear(): void {
    // Remove group references from all objects
    this.groups.forEach((group) => {
      group.memberMirrorGroupIds.forEach((mirrorGroupId) => {
        const objects = this.layerManager.getObjectsByMirrorGroup(mirrorGroupId)
        objects.forEach((obj) => {
          if (obj.tiledMetadata) {
            obj.tiledMetadata.entityGroupId = undefined
          }
        })
      })
    })

    this.groups.clear()
  }

  /**
   * Rename a group
   */
  renameGroup(groupId: string, newName: string): void {
    const group = this.groups.get(groupId)
    if (group) {
      group.name = newName
    }
  }
}
