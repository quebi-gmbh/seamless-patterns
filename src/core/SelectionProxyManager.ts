import { Rect, type Canvas } from 'fabric'
import type { ExtendedFabricObject, ProxyMetadata } from '../types/FabricExtensions'
import type { CanonicalObjectStore } from './CanonicalObjectStore'

/**
 * Extended Rect type with proxy metadata
 */
export interface ProxyRect extends Rect {
  proxyMetadata: ProxyMetadata
}

/**
 * Selection Proxy Manager - creates and manages transparent proxy objects for selection.
 * Proxies are positioned at the clicked tile offset and forward transforms to canonical objects.
 *
 * Coordinate System:
 * - Canvas is 768x768 (3x3 grid of 256px tiles)
 * - Canonical objects are stored in center tile (256-512 range)
 * - Proxies can be created at any tile position (offset by ±tileSize)
 */
export class SelectionProxyManager {
  private canvas: Canvas
  private canonicalStore: CanonicalObjectStore
  private tileSize: number
  private activeProxies: Map<string, ProxyRect> = new Map() // mirrorGroupId → proxy

  constructor(canvas: Canvas, canonicalStore: CanonicalObjectStore, tileSize: number) {
    this.canvas = canvas
    this.canonicalStore = canonicalStore
    this.tileSize = tileSize
  }

  /**
   * Update the tile size (when resolution changes)
   */
  setTileSize(tileSize: number): void {
    this.tileSize = tileSize
  }

  /**
   * Create a selection proxy for a canonical object at a specific tile offset.
   * The proxy appears at the clicked position and shows selection handles.
   *
   * @param canonical - The canonical object to create a proxy for
   * @param tileOffset - The tile offset where the proxy should appear
   * @returns The created proxy rect
   */
  createProxy(
    canonical: ExtendedFabricObject,
    tileOffset: [number, number]
  ): ProxyRect {
    const mirrorGroupId = canonical.tiledMetadata?.mirrorGroupId
    if (!mirrorGroupId) {
      throw new Error('Cannot create proxy for object without mirrorGroupId')
    }

    // Remove existing proxy for this entity if it exists
    this.removeProxy(mirrorGroupId)

    // Calculate proxy position at tile offset
    const [tx, ty] = tileOffset
    const offsetX = tx * this.tileSize
    const offsetY = ty * this.tileSize

    // Get object's bounding box to create appropriately sized proxy
    const bounds = canonical.getBoundingRect()

    // Create transparent proxy rect
    const proxy = new Rect({
      left: (canonical.left || 0) + offsetX,
      top: (canonical.top || 0) + offsetY,
      width: canonical.width || bounds.width,
      height: canonical.height || bounds.height,
      scaleX: canonical.scaleX || 1,
      scaleY: canonical.scaleY || 1,
      angle: canonical.angle || 0,
      flipX: canonical.flipX || false,
      flipY: canonical.flipY || false,
      skewX: canonical.skewX || 0,
      skewY: canonical.skewY || 0,
      originX: canonical.originX || 'left',
      originY: canonical.originY || 'top',
      fill: 'transparent',
      stroke: 'transparent',
      opacity: 0.01, // Nearly invisible but still renders
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingFlip: true,
      uniformScaling: true,
    }) as unknown as ProxyRect

    // Add proxy metadata to link back to canonical
    proxy.proxyMetadata = {
      isProxy: true,
      canonicalObjectId: canonical.id || '',
      mirrorGroupId,
      tileOffset,
    }

    // Add to canvas and track
    this.canvas.add(proxy)
    this.activeProxies.set(mirrorGroupId, proxy)

    return proxy
  }

  /**
   * Remove a proxy by mirrorGroupId
   */
  removeProxy(mirrorGroupId: string): void {
    const proxy = this.activeProxies.get(mirrorGroupId)
    if (proxy) {
      this.canvas.remove(proxy)
      this.activeProxies.delete(mirrorGroupId)
    }
  }

  /**
   * Clear all active proxies
   */
  clearAll(): void {
    this.activeProxies.forEach((proxy) => {
      this.canvas.remove(proxy)
    })
    this.activeProxies.clear()
  }

  /**
   * Get proxy by mirrorGroupId
   */
  getProxy(mirrorGroupId: string): ProxyRect | undefined {
    return this.activeProxies.get(mirrorGroupId)
  }

  /**
   * Get all active proxies
   */
  getAllProxies(): ProxyRect[] {
    return Array.from(this.activeProxies.values())
  }

  /**
   * Check if an object is a proxy
   */
  isProxy(obj: any): obj is ProxyRect {
    return obj?.proxyMetadata?.isProxy === true
  }

  /**
   * Sync transforms from proxy to canonical object.
   * Called when proxy is modified (moved, scaled, rotated).
   *
   * @param proxy - The modified proxy
   */
  syncProxyToCanonical(proxy: ProxyRect): void {
    const { mirrorGroupId, tileOffset } = proxy.proxyMetadata
    const canonical = this.canonicalStore.get(mirrorGroupId)

    if (!canonical) return

    const [tx, ty] = tileOffset
    const offsetX = tx * this.tileSize
    const offsetY = ty * this.tileSize

    // Calculate canonical position from proxy position minus tile offset
    const proxyLeft = proxy.left || 0
    const proxyTop = proxy.top || 0

    // Remove the tile offset to get the position relative to canonical tile
    let canonicalLeft = proxyLeft - offsetX
    let canonicalTop = proxyTop - offsetY

    // Normalize position to center tile range [tileSize, 2*tileSize)
    const normalizeToCenter = (val: number): number => {
      // First get position within any tile [0, tileSize)
      const inTile = ((val % this.tileSize) + this.tileSize) % this.tileSize
      // Then offset to center tile
      return inTile + this.tileSize
    }

    canonicalLeft = normalizeToCenter(canonicalLeft)
    canonicalTop = normalizeToCenter(canonicalTop)

    // Update canonical object with all transforms
    canonical.set({
      left: canonicalLeft,
      top: canonicalTop,
      scaleX: proxy.scaleX,
      scaleY: proxy.scaleY,
      angle: proxy.angle,
      flipX: proxy.flipX,
      flipY: proxy.flipY,
      skewX: proxy.skewX,
      skewY: proxy.skewY,
    })

    // Update control positions
    canonical.setCoords()
  }

  /**
   * Sync transforms from canonical to proxy.
   * Called when canonical object is updated programmatically.
   *
   * @param mirrorGroupId - The mirrorGroupId of the canonical object
   */
  syncCanonicalToProxy(mirrorGroupId: string): void {
    const proxy = this.activeProxies.get(mirrorGroupId)
    const canonical = this.canonicalStore.get(mirrorGroupId)

    if (!proxy || !canonical) return

    const [tx, ty] = proxy.proxyMetadata.tileOffset
    const offsetX = tx * this.tileSize
    const offsetY = ty * this.tileSize

    // Update proxy position at tile offset
    proxy.set({
      left: (canonical.left || 0) + offsetX,
      top: (canonical.top || 0) + offsetY,
      scaleX: canonical.scaleX,
      scaleY: canonical.scaleY,
      angle: canonical.angle,
      flipX: canonical.flipX,
      flipY: canonical.flipY,
      skewX: canonical.skewX,
      skewY: canonical.skewY,
    })

    proxy.setCoords()
  }

  /**
   * Get the count of active proxies
   */
  get size(): number {
    return this.activeProxies.size
  }

  /**
   * Check if a proxy exists for a mirrorGroupId
   */
  hasProxy(mirrorGroupId: string): boolean {
    return this.activeProxies.has(mirrorGroupId)
  }
}
