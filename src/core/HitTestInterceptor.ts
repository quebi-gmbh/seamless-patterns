import type { Point } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'
import type { CanonicalObjectStore } from './CanonicalObjectStore'
import type { LayerManager } from './LayerManager'

/**
 * Result of a hit test, containing the canonical object and the tile offset where it was hit
 */
export interface HitResult {
  canonicalObject: ExtendedFabricObject
  tileOffset: [number, number]
}

/**
 * Tile offsets for 5x5 grid hit testing
 * These are the offsets from the canonical object position to check for hits
 * We use 5x5 to match the virtual rendering grid
 */
function generateTileOffsets(): [number, number][] {
  const offsets: [number, number][] = []
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      offsets.push([x, y])
    }
  }
  return offsets
}

const TILE_OFFSETS = generateTileOffsets() // 25 positions

/**
 * Hit Test Interceptor - detects which tile instance was clicked.
 * Used to determine where to create the selection proxy.
 *
 * Coordinate System:
 * - Canvas is 768x768 (3x3 visible grid of 256px tiles)
 * - Canonical objects are stored in center tile (256-512 range)
 * - Virtual copies are rendered in a 5x5 grid (±2 tiles from center)
 * - Hit testing checks all 25 positions to find clicked objects
 */
export class HitTestInterceptor {
  private tileSize: number
  private canonicalStore: CanonicalObjectStore
  private layerManager: LayerManager | null = null

  constructor(tileSize: number, canonicalStore: CanonicalObjectStore) {
    this.tileSize = tileSize
    this.canonicalStore = canonicalStore
  }

  /**
   * Set the layer manager for checking layer visibility/lock state
   */
  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager
  }

  /**
   * Update the tile size (when resolution changes)
   */
  setTileSize(tileSize: number): void {
    this.tileSize = tileSize
  }

  /**
   * Find the canonical object at a given point, considering all 9 tile positions.
   * Returns the hit object and which tile offset was clicked.
   *
   * @param point - The click point in canvas coordinates
   * @returns HitResult if an object was hit, null otherwise
   */
  findCanonicalObjectAtPoint(point: Point): HitResult | null {
    // Iterate objects in reverse z-order (top to bottom) so topmost object wins
    const objects = this.canonicalStore.getAllReversed()

    // Determine which tile was clicked (0, 1, or 2 for each axis)
    const clickedTileX = Math.floor(point.x / this.tileSize)
    const clickedTileY = Math.floor(point.y / this.tileSize)

    // Create prioritized order: check clicked tile first, then adjacent
    const prioritizedOffsets = this.getPrioritizedOffsets(clickedTileX, clickedTileY)

    for (const obj of objects) {
      if (!this.isInteractable(obj)) continue

      for (const [tx, ty] of prioritizedOffsets) {
        // Calculate the offset from canonical position
        const offsetX = tx * this.tileSize
        const offsetY = ty * this.tileSize

        // Transform click point to check against canonical object
        // If click is at (100, 100) and we're checking offset [-1, 0],
        // we add tileSize to x to see if it hits the canonical object
        const localPoint = {
          x: point.x - offsetX,
          y: point.y - offsetY,
        }

        if (obj.containsPoint(localPoint as Point)) {
          return {
            canonicalObject: obj,
            tileOffset: [tx, ty],
          }
        }
      }
    }

    return null
  }

  /**
   * Get tile offsets ordered by likelihood of containing the click.
   * The clicked tile's offset is checked first.
   */
  private getPrioritizedOffsets(clickedTileX: number, clickedTileY: number): [number, number][] {
    // The canonical objects are in the center tile (index 1)
    // So offset [0,0] corresponds to center tile
    // Clicking in tile 0 means we need offset -1 to reach canonical
    // Clicking in tile 2 means we need offset +1 to reach canonical
    const targetOffsetX = clickedTileX - 1
    const targetOffsetY = clickedTileY - 1

    // Sort by distance from target offset
    return [...TILE_OFFSETS].sort((a, b) => {
      const distA = Math.abs(a[0] - targetOffsetX) + Math.abs(a[1] - targetOffsetY)
      const distB = Math.abs(b[0] - targetOffsetX) + Math.abs(b[1] - targetOffsetY)
      return distA - distB
    })
  }

  /**
   * Find all canonical objects at a given point (for multi-select scenarios)
   *
   * @param point - The click point in canvas coordinates
   * @returns Array of HitResults for all objects at this point
   */
  findAllCanonicalObjectsAtPoint(point: Point): HitResult[] {
    const results: HitResult[] = []
    const objects = this.canonicalStore.getAllReversed()

    for (const obj of objects) {
      if (!this.isInteractable(obj)) continue

      for (const [tx, ty] of TILE_OFFSETS) {
        const offsetX = tx * this.tileSize
        const offsetY = ty * this.tileSize

        const localPoint = {
          x: point.x - offsetX,
          y: point.y - offsetY,
        }

        if (obj.containsPoint(localPoint as Point)) {
          results.push({
            canonicalObject: obj,
            tileOffset: [tx, ty],
          })
          // Only count each object once (use first tile position hit)
          break
        }
      }
    }

    return results
  }

  /**
   * Find objects within a rectangular selection area
   *
   * @param topLeft - Top-left corner of selection
   * @param bottomRight - Bottom-right corner of selection
   * @returns Array of HitResults for objects within the selection
   */
  findCanonicalObjectsInRect(
    topLeft: Point,
    bottomRight: Point
  ): HitResult[] {
    const results: HitResult[] = []
    const objects = this.canonicalStore.getAll()

    for (const obj of objects) {
      if (!this.isInteractable(obj)) continue

      for (const [tx, ty] of TILE_OFFSETS) {
        const offsetX = tx * this.tileSize
        const offsetY = ty * this.tileSize

        // Get object bounds at this tile position
        const bounds = obj.getBoundingRect()
        const objLeft = bounds.left + offsetX
        const objTop = bounds.top + offsetY
        const objRight = objLeft + bounds.width
        const objBottom = objTop + bounds.height

        // Check if object intersects with selection rectangle
        const intersects =
          objLeft < bottomRight.x &&
          objRight > topLeft.x &&
          objTop < bottomRight.y &&
          objBottom > topLeft.y

        if (intersects) {
          results.push({
            canonicalObject: obj,
            tileOffset: [tx, ty],
          })
          // Only count each object once
          break
        }
      }
    }

    return results
  }

  /**
   * Check if an object is interactable (visible, layer not locked)
   * Note: For canonical objects, we don't check obj.selectable/evented since
   * they're intentionally disabled - we create proxies for selection instead.
   */
  private isInteractable(obj: ExtendedFabricObject): boolean {
    // Check basic visibility
    if (obj.visible === false) return false

    // Check layer state if layer manager is available
    if (this.layerManager && obj.layerId) {
      const layer = this.layerManager.getLayer(obj.layerId)
      if (layer) {
        if (!layer.visible) return false
        if (layer.locked) return false
      }
    }

    return true
  }
}
