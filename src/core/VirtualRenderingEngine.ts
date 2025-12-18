import type { ExtendedFabricObject } from "../types/FabricExtensions";
import type { LayerManager } from "./LayerManager";

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
  const offsets: [number, number][] = [];
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      if (x === 0 && y === 0) continue; // Skip center - Fabric renders it
      offsets.push([x, y]);
    }
  }
  return offsets;
}

const TILE_OFFSETS = generateTileOffsets(); // 24 positions

export class VirtualRenderingEngine {
  private tileSize: number;
  private layerManager: LayerManager | null = null;
  private highlightedMirrorGroupIds: Set<string> = new Set();

  constructor(tileSize: number) {
    this.tileSize = tileSize;
  }

  /**
   * Set the highlighted mirror group IDs for hover effect (supports multiple for groups)
   */
  setHighlightedMirrorGroupIds(ids: Set<string>): void {
    this.highlightedMirrorGroupIds = ids;
  }

  /**
   * Get the currently highlighted mirror group IDs
   */
  getHighlightedMirrorGroupIds(): Set<string> {
    return this.highlightedMirrorGroupIds;
  }

  /**
   * Set the layer manager for layer-aware rendering
   */
  setLayerManager(manager: LayerManager): void {
    this.layerManager = manager;
  }

  /**
   * Update the tile size (when resolution changes)
   */
  setTileSize(tileSize: number): void {
    this.tileSize = tileSize;
  }

  /**
   * Sort objects by layer order, then by within-layer z-order.
   * Higher layer order = rendered later = appears in front.
   */
  private sortByLayerOrder(
    objects: ExtendedFabricObject[]
  ): ExtendedFabricObject[] {
    if (!this.layerManager) return objects;

    const layers = this.layerManager.getLayers(); // sorted by order ascending (0 = bottom)
    const layerOrderMap = new Map(layers.map((l) => [l.id, l.order]));

    // Create array with indices to preserve within-layer order
    const indexed = objects.map((obj, idx) => ({ obj, idx }));

    indexed.sort((a, b) => {
      const layerOrderA = layerOrderMap.get(a.obj.layerId || "") ?? 0;
      const layerOrderB = layerOrderMap.get(b.obj.layerId || "") ?? 0;

      if (layerOrderA !== layerOrderB) {
        return layerOrderA - layerOrderB; // Lower order = rendered first = behind
      }
      // Same layer: maintain original array order (which is insertion order)
      return a.idx - b.idx;
    });

    return indexed.map((item) => item.obj);
  }

  /**
   * Render the additional 24 instances for each canonical object.
   * Called in after:render event - Fabric.js has already rendered objects at their
   * canonical position, so we render copies at the 24 surrounding tile positions (5x5 grid).
   *
   * Objects are sorted by layer order first (lower layer order = rendered behind),
   * then by within-layer z-order (insertion order).
   *
   * @param ctx - Canvas 2D rendering context
   * @param objects - Array of canonical objects to render
   */
  renderVirtualCopies(
    ctx: CanvasRenderingContext2D,
    objects: ExtendedFabricObject[]
  ): void {
    // Sort objects by layer order for proper rendering
    const sortedObjects = this.sortByLayerOrder(objects);

    for (const obj of sortedObjects) {
      // Skip if object is not visible
      if (obj.visible === false) continue;

      // Skip objects without tiled metadata (non-tiled objects like grid lines)
      if (!obj.tiledMetadata) continue;

      // Check if this object should be highlighted
      const isHighlighted =
        this.highlightedMirrorGroupIds.size > 0 &&
        this.highlightedMirrorGroupIds.has(obj.tiledMetadata.mirrorGroupId);

      // Get object bounds for highlight (only calculate once per object)
      const bounds = isHighlighted ? obj.getBoundingRect() : null;

      // Render at each of the 24 surrounding tile positions
      for (const [tx, ty] of TILE_OFFSETS) {
        const offsetX = tx * this.tileSize;
        const offsetY = ty * this.tileSize;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Apply glow effect for highlighted objects
        if (isHighlighted && bounds) {
          ctx.shadowColor = "rgba(45, 212, 168, 0.8)";
          ctx.shadowBlur = 20;

          // For small objects, draw a minimum-size glow rect behind
          const minSize = 24;
          if (bounds.width < minSize && bounds.height < minSize) {
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            const rectWidth = Math.max(bounds.width, minSize);
            const rectHeight = Math.max(bounds.height, minSize);

            ctx.fillStyle = "rgba(45, 212, 168, 0.3)";
            ctx.beginPath();
            ctx.roundRect(
              centerX - rectWidth / 2,
              centerY - rectHeight / 2,
              rectWidth,
              rectHeight,
              4
            );
            ctx.fill();
          }
        }

        obj.render(ctx);
        ctx.restore();
      }
    }
  }

  /**
   * Render all 25 instances for each canonical object (5x5 grid).
   * Used when we need to fully control rendering (e.g., for export).
   *
   * Objects are sorted by layer order first (lower layer order = rendered behind),
   * then by within-layer z-order (insertion order).
   *
   * @param ctx - Canvas 2D rendering context
   * @param objects - Array of canonical objects to render
   */
  renderAllInstances(
    ctx: CanvasRenderingContext2D,
    objects: ExtendedFabricObject[]
  ): void {
    // Sort objects by layer order for proper rendering
    const sortedObjects = this.sortByLayerOrder(objects);

    for (const obj of sortedObjects) {
      if (obj.visible === false) continue;
      if (!obj.tiledMetadata) continue;

      // Render at all 25 positions (including center)
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const offsetX = x * this.tileSize;
          const offsetY = y * this.tileSize;

          ctx.save();
          ctx.translate(offsetX, offsetY);
          obj.render(ctx);
          ctx.restore();
        }
      }
    }
  }

  /**
   * Get the tile size
   */
  getTileSize(): number {
    return this.tileSize;
  }
}
