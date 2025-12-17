import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'
import { generateUniqueId } from '../utils/idGenerator'
import { extractSVGInnerContent } from '../utils/svgUtils'
import type { CanonicalObjectStore } from './CanonicalObjectStore'

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number
}

export class LayerManager {
  private canvas: Canvas
  private layers: Map<string, Layer> = new Map()
  private defaultLayerId: string

  // Optional canonical store for virtual tiling mode
  private canonicalStore: CanonicalObjectStore | null = null

  constructor(canvas: Canvas) {
    this.canvas = canvas

    // Create default layer
    this.defaultLayerId = generateUniqueId('layer')
    this.layers.set(this.defaultLayerId, {
      id: this.defaultLayerId,
      name: 'Layer 1',
      visible: true,
      locked: false,
      order: 0,
    })
  }

  /**
   * Set the canonical store for virtual tiling mode
   */
  setCanonicalStore(store: CanonicalObjectStore): void {
    this.canonicalStore = store
  }

  /**
   * Check if virtual tiling mode is enabled
   */
  isVirtualTilingEnabled(): boolean {
    return this.canonicalStore !== null
  }

  /**
   * Get all tiled objects - from canonical store if available, otherwise from canvas
   */
  private getAllTiledObjects(): ExtendedFabricObject[] {
    if (this.canonicalStore) {
      return this.canonicalStore.getAll()
    }
    // Legacy mode: filter canvas objects
    return this.canvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject
      return extObj.tiledMetadata && !(extObj as any).gridLine
    }) as ExtendedFabricObject[]
  }

  /**
   * Create a new layer
   */
  createLayer(name?: string): Layer {
    const layerId = generateUniqueId('layer')
    const order = this.layers.size
    const layer: Layer = {
      id: layerId,
      name: name || `Layer ${this.layers.size + 1}`,
      visible: true,
      locked: false,
      order,
    }
    this.layers.set(layerId, layer)
    return layer
  }

  /**
   * Delete a layer and all its objects
   */
  deleteLayer(layerId: string): void {
    if (layerId === this.defaultLayerId) {
      throw new Error('Cannot delete default layer')
    }

    // Remove all objects on this layer
    const objects = this.getObjectsByLayer(layerId)
    objects.forEach((obj) => this.canvas.remove(obj))

    this.layers.delete(layerId)
    this.canvas.requestRenderAll()
  }

  /**
   * Get all layers sorted by order
   */
  getLayers(): Layer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * Get a specific layer
   */
  getLayer(layerId: string): Layer | undefined {
    return this.layers.get(layerId)
  }

  /**
   * Update layer properties
   */
  updateLayer(layerId: string, updates: Partial<Omit<Layer, 'id'>>): void {
    const layer = this.layers.get(layerId)
    if (!layer) return

    Object.assign(layer, updates)

    // Apply visibility changes
    if (updates.visible !== undefined) {
      const objects = this.getObjectsByLayer(layerId)
      objects.forEach((obj) => {
        obj.visible = updates.visible!
      })
      this.canvas.requestRenderAll()
    }

    // Apply lock changes
    if (updates.locked !== undefined) {
      const objects = this.getObjectsByLayer(layerId)
      objects.forEach((obj) => {
        obj.selectable = !updates.locked
        obj.evented = !updates.locked
      })
      this.canvas.requestRenderAll()
    }
  }

  /**
   * Reorder layers
   */
  reorderLayers(fromIndex: number, toIndex: number): void {
    const layers = this.getLayers()
    const [movedLayer] = layers.splice(fromIndex, 1)
    layers.splice(toIndex, 0, movedLayer)

    // Update order values
    layers.forEach((layer, index) => {
      layer.order = index
    })
  }

  /**
   * Get all objects on a specific layer
   */
  getObjectsByLayer(layerId: string): ExtendedFabricObject[] {
    return this.canvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject
      return extObj.layerId === layerId
    }) as ExtendedFabricObject[]
  }

  /**
   * Move object to a different layer
   */
  moveObjectToLayer(objectId: string, targetLayerId: string): void {
    const obj = this.canvas.getObjects().find((o) => {
      const extObj = o as ExtendedFabricObject
      return extObj.id === objectId
    }) as ExtendedFabricObject | undefined

    if (obj) {
      obj.layerId = targetLayerId
    }
  }

  /**
   * Get default layer ID
   */
  getDefaultLayerId(): string {
    return this.defaultLayerId
  }

  /**
   * Get all unique mirror groups (returns one object per tiled group)
   * In virtual tiling mode, each group has exactly 1 object (the canonical)
   */
  getMirrorGroups(): Map<string, ExtendedFabricObject[]> {
    const groups = new Map<string, ExtendedFabricObject[]>()

    // Use canonical store if available, otherwise query canvas
    const objects = this.getAllTiledObjects()

    objects.forEach((obj) => {
      if (obj.tiledMetadata?.mirrorGroupId) {
        const groupId = obj.tiledMetadata.mirrorGroupId
        if (!groups.has(groupId)) {
          groups.set(groupId, [])
        }
        groups.get(groupId)!.push(obj)
      }
    })

    return groups
  }

  /**
   * Delete all objects in a mirror group
   */
  deleteMirrorGroup(mirrorGroupId: string): void {
    if (this.canonicalStore) {
      // Virtual tiling mode: remove from store and canvas
      const obj = this.canonicalStore.get(mirrorGroupId)
      if (obj) {
        this.canvas.remove(obj)
        this.canonicalStore.remove(mirrorGroupId)
      }
    } else {
      // Legacy mode: remove all 25 copies from canvas
      const objects = this.canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject
        return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
      })
      objects.forEach((obj) => this.canvas.remove(obj))
    }
    this.canvas.requestRenderAll()
  }

  /**
   * Bring mirror group forward (z-index)
   */
  bringMirrorGroupForward(mirrorGroupId: string): void {
    if (this.canonicalStore) {
      // Virtual tiling mode: update store z-order and canvas
      this.canonicalStore.bringForward(mirrorGroupId)
      const obj = this.canonicalStore.get(mirrorGroupId)
      if (obj) this.canvas.bringObjectForward(obj)
    } else {
      // Legacy mode
      const objects = this.canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject
        return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
      })
      objects.forEach((obj) => this.canvas.bringObjectForward(obj))
    }
    this.canvas.requestRenderAll()
  }

  /**
   * Send mirror group backward (z-index)
   */
  sendMirrorGroupBackward(mirrorGroupId: string): void {
    if (this.canonicalStore) {
      // Virtual tiling mode: update store z-order and canvas
      this.canonicalStore.sendBackward(mirrorGroupId)
      const obj = this.canonicalStore.get(mirrorGroupId)
      if (obj) this.canvas.sendObjectBackwards(obj)
    } else {
      // Legacy mode
      const objects = this.canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject
        return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
      })
      objects.forEach((obj) => this.canvas.sendObjectBackwards(obj))
    }
    this.canvas.requestRenderAll()
  }

  /**
   * Bring mirror group to front
   */
  bringMirrorGroupToFront(mirrorGroupId: string): void {
    if (this.canonicalStore) {
      // Virtual tiling mode: update store z-order and canvas
      this.canonicalStore.bringToFront(mirrorGroupId)
      const obj = this.canonicalStore.get(mirrorGroupId)
      if (obj) this.canvas.bringObjectToFront(obj)
    } else {
      // Legacy mode
      const objects = this.canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject
        return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
      })
      objects.forEach((obj) => this.canvas.bringObjectToFront(obj))
    }
    this.canvas.requestRenderAll()
  }

  /**
   * Send mirror group to back
   */
  sendMirrorGroupToBack(mirrorGroupId: string): void {
    if (this.canonicalStore) {
      // Virtual tiling mode: update store z-order and canvas
      this.canonicalStore.sendToBack(mirrorGroupId)
      const obj = this.canonicalStore.get(mirrorGroupId)
      if (obj) this.canvas.sendObjectToBack(obj)
    } else {
      // Legacy mode
      const objects = this.canvas.getObjects().filter((obj) => {
        const extObj = obj as ExtendedFabricObject
        return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
      })
      objects.forEach((obj) => this.canvas.sendObjectToBack(obj))
    }
    this.canvas.requestRenderAll()
  }

  /**
   * Get objects by mirror group ID
   * In virtual tiling mode, returns array with single canonical object
   */
  getObjectsByMirrorGroup(mirrorGroupId: string): ExtendedFabricObject[] {
    if (this.canonicalStore) {
      // Virtual tiling mode: return single canonical object
      const obj = this.canonicalStore.get(mirrorGroupId)
      return obj ? [obj] : []
    }
    // Legacy mode: return all 25 copies
    return this.canvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject
      return extObj.tiledMetadata?.mirrorGroupId === mirrorGroupId
    }) as ExtendedFabricObject[]
  }

  /**
   * Get SVG code from a mirror group (if it's an SVG group)
   */
  /**
   * Get SVG code from a mirror group (if it's an SVG group)
   * Returns inner content only (without root <svg> tag)
   */
  getSVGCode(mirrorGroupId: string): string | null {
    const objects = this.getObjectsByMirrorGroup(mirrorGroupId)
    if (objects.length === 0) return null

    const firstObj = objects[0]
    // Check if the object has SVG source data
    if ((firstObj as any).toSVG) {
      try {
        const completeSVG = (firstObj as any).toSVG()
        // Extract inner content using utility
        return extractSVGInnerContent(completeSVG)
      } catch {
        return null
      }
    }
    return null
  }

  /**
   * Get only center tile objects (tilePosition [0,0]) for a specific layer
   * Used for export to avoid redundancy
   * In virtual tiling mode, all objects are canonical (tilePosition [0,0])
   */
  getCenterTileObjectsByLayer(layerId: string): ExtendedFabricObject[] {
    if (this.canonicalStore) {
      // Virtual tiling mode: all objects are canonical (center tile)
      return this.canonicalStore.getByLayer(layerId)
    }
    // Legacy mode: filter to center tile only
    return this.getObjectsByLayer(layerId).filter((obj) =>
      obj.tiledMetadata?.tilePosition?.[0] === 0 &&
      obj.tiledMetadata?.tilePosition?.[1] === 0
    )
  }

  /**
   * Clear all objects and layers, then recreate default layer
   * Used for project import
   */
  clear(): void {
    // Clear canonical store if in virtual tiling mode
    if (this.canonicalStore) {
      this.canonicalStore.clear()
    }

    // Remove all objects except grid lines
    const objects = this.canvas.getObjects().filter((obj: any) => !obj.gridLine)
    objects.forEach((obj) => this.canvas.remove(obj))

    // Clear layers Map
    this.layers.clear()

    // Recreate default layer
    this.defaultLayerId = generateUniqueId('layer')
    this.layers.set(this.defaultLayerId, {
      id: this.defaultLayerId,
      name: 'Layer 1',
      visible: true,
      locked: false,
      order: 0,
    })

    this.canvas.requestRenderAll()
  }

  /**
   * Import layers from serialized data
   * Assumes canvas has already been cleared
   */
  importLayers(layersData: Layer[]): void {
    // Clear existing layers
    this.layers.clear()

    // Import all layers
    layersData.forEach((layer) => {
      this.layers.set(layer.id, layer)
    })

    // Set default layer ID to the first layer if available
    if (layersData.length > 0) {
      this.defaultLayerId = layersData[0].id
    }
  }
}
