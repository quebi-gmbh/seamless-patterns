import type { ExtendedFabricObject } from '../types/FabricExtensions'

/**
 * Virtual Rendering Engine - draws 25 instances of each canonical object
 * to create seamless tiling on a 3x3 visible grid canvas.
 *
 * Coordinate System:
 * - Canvas is 768x768 (3x3 grid of 256px tiles visible)
 * - Center tile is at (256, 256) to (512, 512)
 * - Canonical objects are stored at their actual canvas position (in center tile)
 * - This engine renders copies at 24 surrounding tile positions (5x5 grid minus center)
 *
 * Why 5x5 instead of 3x3:
 * Objects near the edge of the center tile need their copies to appear in adjacent
 * visible tiles. A 5x5 grid ensures complete coverage even for objects at tile edges.
 *
 * Tile layout (5x5 grid, offsets from object position):
 * ┌────────┬────────┬────────┬────────┬────────┐
 * │ -2,-2  │ -1,-2  │  0,-2  │ +1,-2  │ +2,-2  │
 * ├────────┼────────┼────────┼────────┼────────┤
 * │ -2,-1  │ -1,-1  │  0,-1  │ +1,-1  │ +2,-1  │
 * ├────────┼────────┼────────┼────────┼────────┤
 * │ -2, 0  │ -1, 0  │  0, 0  │ +1, 0  │ +2, 0  │  ← center row (0,0 = Fabric renders)
 * ├────────┼────────┼────────┼────────┼────────┤
 * │ -2,+1  │ -1,+1  │  0,+1  │ +1,+1  │ +2,+1  │
 * ├────────┼────────┼────────┼────────┼────────┤
 * │ -2,+2  │ -1,+2  │  0,+2  │ +1,+2  │ +2,+2  │
 * └────────┴────────┴────────┴────────┴────────┘
 */

// Generate 5x5 tile offsets excluding center [0,0]
function generateTileOffsets(): [number, number][] {
  const offsets: [number, number][] = []
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      if (x === 0 && y === 0) continue // Skip center - Fabric renders it
      offsets.push([x, y])
    }
  }
  return offsets
}

const TILE_OFFSETS = generateTileOffsets() // 24 positions

export class VirtualRenderingEngine {
  private tileSize: number

  constructor(tileSize: number) {
    this.tileSize = tileSize
  }

  /**
   * Update the tile size (when resolution changes)
   */
  setTileSize(tileSize: number): void {
    this.tileSize = tileSize
  }

  /**
   * Render the additional 24 instances for each canonical object.
   * Called in after:render event - Fabric.js has already rendered objects at their
   * canonical position, so we render copies at the 24 surrounding tile positions (5x5 grid).
   *
   * @param ctx - Canvas 2D rendering context
   * @param objects - Array of canonical objects to render
   */
  renderVirtualCopies(
    ctx: CanvasRenderingContext2D,
    objects: ExtendedFabricObject[]
  ): void {
    for (const obj of objects) {
      // Skip if object is not visible
      if (obj.visible === false) continue

      // Skip objects without tiled metadata (non-tiled objects like grid lines)
      if (!obj.tiledMetadata) continue

      // Render at each of the 24 surrounding tile positions
      for (const [tx, ty] of TILE_OFFSETS) {
        const offsetX = tx * this.tileSize
        const offsetY = ty * this.tileSize

        ctx.save()
        ctx.translate(offsetX, offsetY)
        obj.render(ctx)
        ctx.restore()
      }
    }
  }

  /**
   * Render all 25 instances for each canonical object (5x5 grid).
   * Used when we need to fully control rendering (e.g., for export).
   *
   * @param ctx - Canvas 2D rendering context
   * @param objects - Array of canonical objects to render
   */
  renderAllInstances(
    ctx: CanvasRenderingContext2D,
    objects: ExtendedFabricObject[]
  ): void {
    for (const obj of objects) {
      if (obj.visible === false) continue
      if (!obj.tiledMetadata) continue

      // Render at all 25 positions (including center)
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const offsetX = x * this.tileSize
          const offsetY = y * this.tileSize

          ctx.save()
          ctx.translate(offsetX, offsetY)
          obj.render(ctx)
          ctx.restore()
        }
      }
    }
  }

  /**
   * Get the tile size
   */
  getTileSize(): number {
    return this.tileSize
  }
}
