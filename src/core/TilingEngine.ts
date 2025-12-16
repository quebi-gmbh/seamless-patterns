import type { Canvas, FabricObject } from 'fabric'
import type { ExtendedFabricObject, TiledObjectMetadata } from '../types/FabricExtensions'
import { generateUniqueId } from '../utils/idGenerator'

export class TilingEngine {
  private canvas: Canvas
  private tileSize: number
  private syncEnabled: boolean = true

  constructor(canvas: Canvas, tileSize: number) {
    this.canvas = canvas
    this.tileSize = tileSize
    this.setupTransformSync()
  }

  /**
   * Creates a tiled object - 25 copies in a 5x5 grid, all selectable
   * @param originalObject The Fabric object to tile
   * @param position The click position where the object was created
   * @param layerId Optional layer ID to assign to all objects
   * @returns Array of all 25 objects
   */
  async createTiledObject(
    originalObject: FabricObject,
    position: { x: number; y: number },
    layerId?: string
  ): Promise<ExtendedFabricObject[]> {
    // Calculate position within center tile using modulo
    // This normalizes the position to [0, tileSize) range
    const offsetX = ((position.x % this.tileSize) + this.tileSize) % this.tileSize
    const offsetY = ((position.y % this.tileSize) + this.tileSize) % this.tileSize

    const mirrorGroupId = generateUniqueId('mirror_group')
    const allObjects: ExtendedFabricObject[] = []

    // Create 5x5 grid from (-2,-2) to (2,2)
    // Canvas coordinate system: center tile [0, tileSize] is at tile position (0,0)
    // Visible area: [-tileSize, 2*tileSize] × [-tileSize, 2*tileSize]
    for (let ty = -2; ty <= 2; ty++) {
      for (let tx = -2; tx <= 2; tx++) {
        // Clone the object (or use original for first iteration)
        const obj = (tx === -2 && ty === -2)
          ? originalObject
          : await this.cloneObject(originalObject)

        const extObj = obj as ExtendedFabricObject

        // Calculate canvas position for this tile
        // Tile (0,0) is centered at [0, tileSize], so tile (tx, ty) is at [tx*tileSize, (tx+1)*tileSize]
        const canvasX = tx * this.tileSize + offsetX
        const canvasY = ty * this.tileSize + offsetY

        // All objects are selectable and evented
        extObj.set({
          left: canvasX,
          top: canvasY,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingFlip: true,
          uniformScaling: true, // Enable uniform scaling to preserve aspect ratio
        })

        // Add unique ID if not present
        if (!extObj.id) {
          extObj.id = generateUniqueId('obj')
        }

        // Add tiling metadata - no concept of "primary" anymore
        const metadata: TiledObjectMetadata = {
          isMirror: false, // All are equal now
          mirrorGroupId,
          tilePosition: [tx, ty],
        }
        extObj.tiledMetadata = metadata

        // Assign layer ID if provided
        if (layerId) {
          extObj.layerId = layerId
        }

        allObjects.push(extObj)
        this.canvas.add(extObj)
      }
    }

    this.canvas.requestRenderAll()
    return allObjects
  }

  /**
   * Clone a Fabric object asynchronously
   */
  private async cloneObject(obj: FabricObject): Promise<FabricObject> {
    // Fabric.js v6 uses async clone
    return await obj.clone()
  }

  /**
   * Get all mirror objects for a given mirror group ID
   */
  getMirrorsByGroupId(groupId: string): ExtendedFabricObject[] {
    return this.canvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject
      return extObj.tiledMetadata?.mirrorGroupId === groupId
    }) as ExtendedFabricObject[]
  }

  /**
   * Get the primary object for a mirror group
   */
  getPrimaryObject(groupId: string): ExtendedFabricObject | null {
    const objects = this.getMirrorsByGroupId(groupId)
    return objects.find((obj) => !obj.tiledMetadata?.isMirror) || null
  }

  /**
   * Remove all objects in a mirror group
   */
  removeObjectGroup(groupId: string): void {
    const objects = this.getMirrorsByGroupId(groupId)
    objects.forEach((obj) => {
      this.canvas.remove(obj)
    })
    this.canvas.requestRenderAll()
  }

  /**
   * Update the tile size (call when resolution changes)
   */
  updateTileSize(newTileSize: number): void {
    this.tileSize = newTileSize
  }

  /**
   * Setup event listeners to sync transforms across all mirrored objects
   */
  private setupTransformSync(): void {
    // Sync on object modification (after move, scale, rotate)
    this.canvas.on('object:modified', (e) => {
      const target = e.target
      if (!target) return

      const extTarget = target as ExtendedFabricObject
      if (!extTarget.tiledMetadata) return

      this.syncMirrorTransforms(extTarget)
    })

    // Sync during moving (real-time)
    this.canvas.on('object:moving', (e) => {
      const target = e.target
      if (!target) return

      const extTarget = target as ExtendedFabricObject
      if (!extTarget.tiledMetadata) return

      this.syncMirrorTransforms(extTarget)
    })

    // Sync during scaling
    this.canvas.on('object:scaling', (e) => {
      const target = e.target
      if (!target) return

      const extTarget = target as ExtendedFabricObject
      if (!extTarget.tiledMetadata) return

      this.syncMirrorTransforms(extTarget)
    })

    // Sync during rotating
    this.canvas.on('object:rotating', (e) => {
      const target = e.target
      if (!target) return

      const extTarget = target as ExtendedFabricObject
      if (!extTarget.tiledMetadata) return

      this.syncMirrorTransforms(extTarget)
    })
  }

  /**
   * Synchronize all tiled objects to match the transformed object
   */
  private syncMirrorTransforms(sourceObject: ExtendedFabricObject): void {
    if (!this.syncEnabled) return

    const metadata = sourceObject.tiledMetadata
    if (!metadata) return

    const allTiledObjects = this.getMirrorsByGroupId(metadata.mirrorGroupId)

    // Get source object's current absolute position
    const sourceLeft = sourceObject.left || 0
    const sourceTop = sourceObject.top || 0

    // Get the source object's original tile position from metadata
    const [sourceTx, sourceTy] = metadata.tilePosition

    // Update all other objects in the mirror group
    allTiledObjects.forEach((obj) => {
      if (obj === sourceObject) return

      const [objTx, objTy] = obj.tiledMetadata!.tilePosition

      // Calculate the tile offset between this object and the source
      const tileOffsetX = objTx - sourceTx
      const tileOffsetY = objTy - sourceTy

      // Position this object at: source position + (tile offset * tile size)
      // This maintains the tiling pattern regardless of where the source is
      const newLeft = sourceLeft + (tileOffsetX * this.tileSize)
      const newTop = sourceTop + (tileOffsetY * this.tileSize)

      // Apply all transforms
      obj.set({
        left: newLeft,
        top: newTop,
        scaleX: sourceObject.scaleX,
        scaleY: sourceObject.scaleY,
        angle: sourceObject.angle,
        flipX: sourceObject.flipX,
        flipY: sourceObject.flipY,
        skewX: sourceObject.skewX,
        skewY: sourceObject.skewY,
      })

      // Update control positions
      obj.setCoords()
    })

    this.canvas.requestRenderAll()
  }
}
