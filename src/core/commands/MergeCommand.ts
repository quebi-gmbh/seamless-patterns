import * as fabric from 'fabric'
import type { Command, CommandDependencies, SerializedObjectData } from './types'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'

/**
 * Command for merging multiple path objects into one.
 * Stores the serialized original objects to enable restoration on undo.
 */
export class MergeCommand implements Command {
  readonly type = 'merge'
  readonly description: string
  readonly timestamp: number

  private originalObjects: SerializedObjectData[]
  private mergedMirrorGroupId: string | null = null
  private mergedLayerId: string
  private mergedObjectJSON: string

  constructor(
    private originalMirrorGroupIds: string[],
    objectsToMerge: ExtendedFabricObject[],
    mergedObject: fabric.Path,
    layerId: string,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = `Merge ${objectsToMerge.length} paths`
    this.mergedLayerId = layerId

    // Serialize the merged object for execute
    // Use type assertion to handle custom properties that Fabric types don't know about
    const additionalProps = ['tiledMetadata', 'layerId', 'id'] as const
    this.mergedObjectJSON = JSON.stringify(
      (mergedObject as fabric.FabricObject).toObject(additionalProps as unknown as (keyof fabric.FabricObject)[])
    )

    // Capture full state of all original objects before merging
    this.originalObjects = objectsToMerge.map((obj, index) => ({
      mirrorGroupId: this.originalMirrorGroupIds[index],
      layerId: obj.layerId || '',
      zOrderIndex: deps.canonicalStore.getZOrderIndex(this.originalMirrorGroupIds[index]),
      fabricObjectJSON: JSON.stringify(obj.toObject([
        'tiledMetadata',
        'layerId',
        'id',
      ])),
      entityGroupId: obj.tiledMetadata?.entityGroupId,
    }))
  }

  async execute(): Promise<void> {
    // Delete all original objects
    for (const mirrorGroupId of this.originalMirrorGroupIds) {
      const obj = this.deps.canonicalStore.get(mirrorGroupId)
      if (obj) {
        this.deps.canvas.remove(obj)
        this.deps.canonicalStore.remove(mirrorGroupId)
        this.deps.selectionProxyManager?.removeProxy(mirrorGroupId)
      }
    }

    // Create the merged object
    const objectData = JSON.parse(this.mergedObjectJSON)
    const objects = await fabric.util.enlivenObjects([objectData])
    if (objects.length === 0) return

    const mergedObj = objects[0] as ExtendedFabricObject

    // Generate new mirrorGroupId if not already set
    if (!this.mergedMirrorGroupId) {
      this.mergedMirrorGroupId = `tiled_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }

    // Set up metadata
    mergedObj.tiledMetadata = {
      isMirror: false,
      mirrorGroupId: this.mergedMirrorGroupId,
      tilePosition: [0, 0],
    }
    mergedObj.layerId = this.mergedLayerId

    // Make it non-selectable (canonical objects are selected via proxies)
    mergedObj.set({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    })

    // Add to canonical store
    this.deps.canonicalStore.add(mergedObj, this.mergedMirrorGroupId)

    // Add to canvas
    this.deps.canvas.add(mergedObj)
    this.deps.canvas.requestRenderAll()
  }

  async undo(): Promise<void> {
    // Delete the merged object
    if (this.mergedMirrorGroupId) {
      const mergedObj = this.deps.canonicalStore.get(this.mergedMirrorGroupId)
      if (mergedObj) {
        this.deps.canvas.remove(mergedObj)
        this.deps.canonicalStore.remove(this.mergedMirrorGroupId)
        this.deps.selectionProxyManager?.removeProxy(this.mergedMirrorGroupId)
      }
    }

    // Restore all original objects
    // Sort by zOrderIndex to restore in correct order
    const sortedOriginals = [...this.originalObjects].sort((a, b) => a.zOrderIndex - b.zOrderIndex)

    for (const data of sortedOriginals) {
      const objectData = JSON.parse(data.fabricObjectJSON)
      const objects = await fabric.util.enlivenObjects([objectData])
      if (objects.length === 0) continue

      const recreatedObj = objects[0] as ExtendedFabricObject

      // Restore metadata
      recreatedObj.tiledMetadata = {
        isMirror: false,
        mirrorGroupId: data.mirrorGroupId,
        tilePosition: [0, 0],
        entityGroupId: data.entityGroupId,
      }
      recreatedObj.layerId = data.layerId

      // Make it non-selectable (canonical objects are selected via proxies)
      recreatedObj.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      })

      // Add to canonical store at original z-order position
      this.deps.canonicalStore.addAtIndex(
        recreatedObj,
        data.mirrorGroupId,
        data.zOrderIndex
      )

      // Add to canvas
      this.deps.canvas.add(recreatedObj)
    }

    this.deps.canvas.requestRenderAll()
  }

  /**
   * Get the mirrorGroupId of the merged object (after execute)
   */
  getMergedMirrorGroupId(): string | null {
    return this.mergedMirrorGroupId
  }
}
