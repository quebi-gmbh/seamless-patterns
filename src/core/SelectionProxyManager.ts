import { Rect, type Canvas } from 'fabric'
import type { ExtendedFabricObject, ProxyMetadata } from '../types/FabricExtensions'
import type { CanonicalObjectStore } from './CanonicalObjectStore'

// Minimum proxy size = 2x default corner handle size (13px) to ensure handles don't overlap
const MIN_PROXY_SIZE = 26

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

    // Use canonical dimensions, enforcing minimum size for usable controls
    const scaleX = canonical.scaleX || 1
    const scaleY = canonical.scaleY || 1
    const baseWidth = canonical.width || bounds.width
    const baseHeight = canonical.height || bounds.height

    // Calculate minimum base size needed to achieve MIN_PROXY_SIZE after scaling
    const minBaseWidth = MIN_PROXY_SIZE / scaleX
    const minBaseHeight = MIN_PROXY_SIZE / scaleY
    const proxyBaseWidth = Math.max(baseWidth, minBaseWidth)
    const proxyBaseHeight = Math.max(baseHeight, minBaseHeight)

    // Center the enlarged proxy over the actual object
    const leftAdjust = ((proxyBaseWidth - baseWidth) * scaleX) / 2
    const topAdjust = ((proxyBaseHeight - baseHeight) * scaleY) / 2

    // Create transparent proxy rect that mirrors canonical transforms
    const proxy = new Rect({
      left: (canonical.left || 0) + offsetX - leftAdjust,
      top: (canonical.top || 0) + offsetY - topAdjust,
      width: proxyBaseWidth,
      height: proxyBaseHeight,
      scaleX: scaleX,
      scaleY: scaleY,
      angle: canonical.angle || 0,
      flipX: canonical.flipX || false,
      flipY: canonical.flipY || false,
      skewX: canonical.skewX || 0,
      skewY: canonical.skewY || 0,
      originX: canonical.originX || 'left',
      originY: canonical.originY || 'top',
      fill: 'rgba(0,0,0,0.004)', // Nearly invisible but has pixels for hit detection
      stroke: 'transparent',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingFlip: true,
      uniformScaling: true,
      moveCursor: 'move',
      hoverCursor: 'move',
      perPixelTargetFind: false, // Use bounding box hit detection for proxy
      objectCaching: false, // Disable caching to ensure fresh hit detection
    }) as unknown as ProxyRect

    // Add proxy metadata to link back to canonical
    proxy.proxyMetadata = {
      isProxy: true,
      canonicalObjectId: canonical.id || '',
      mirrorGroupId,
      tileOffset,
      sizeAdjust: [leftAdjust, topAdjust],
      baseSize: [baseWidth, baseHeight], // Original canonical size (before any proxy enlargement)
      baseScale: [scaleX, scaleY], // Scale at proxy creation time
    }

    // Add to canvas, bring to front for controls visibility, and calculate coords
    this.canvas.add(proxy)
    this.canvas.bringObjectToFront(proxy)
    proxy.setCoords()
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
    const { mirrorGroupId, tileOffset, sizeAdjust, baseSize } = proxy.proxyMetadata
    const canonical = this.canonicalStore.get(mirrorGroupId)

    if (!canonical) return

    const [tx, ty] = tileOffset
    const offsetX = tx * this.tileSize
    const offsetY = ty * this.tileSize
    const [leftAdjust, topAdjust] = sizeAdjust
    const [baseWidth, baseHeight] = baseSize

    // Get proxy transforms
    const proxyLeft = proxy.left || 0
    const proxyTop = proxy.top || 0
    const proxyScaleX = proxy.scaleX || 1
    const proxyScaleY = proxy.scaleY || 1

    // The proxy may be enlarged for minimum size - calculate the scale ratio
    // Proxy width/height might be larger than baseSize, so we need to find the actual scale
    const proxyBaseWidth = proxy.width || baseWidth
    const proxyBaseHeight = proxy.height || baseHeight
    const widthRatio = proxyBaseWidth / baseWidth
    const heightRatio = proxyBaseHeight / baseHeight

    // New canonical scale = proxy scale (which is relative to proxy's base size)
    // divided by the enlargement ratio to get back to canonical base size
    const newScaleX = (proxyScaleX * widthRatio)
    const newScaleY = (proxyScaleY * heightRatio)

    // Recalculate size adjustment for new scale
    const minBaseWidth = MIN_PROXY_SIZE / newScaleX
    const minBaseHeight = MIN_PROXY_SIZE / newScaleY
    const newProxyBaseWidth = Math.max(baseWidth, minBaseWidth)
    const newProxyBaseHeight = Math.max(baseHeight, minBaseHeight)
    const newLeftAdjust = ((newProxyBaseWidth - baseWidth) * newScaleX) / 2
    const newTopAdjust = ((newProxyBaseHeight - baseHeight) * newScaleY) / 2

    // Remove tile offset and size adjustment to get canonical position
    let canonicalLeft = proxyLeft - offsetX + leftAdjust
    let canonicalTop = proxyTop - offsetY + topAdjust

    // Normalize position to center tile range [tileSize, 2*tileSize)
    const normalizeToCenter = (val: number): number => {
      const inTile = ((val % this.tileSize) + this.tileSize) % this.tileSize
      return inTile + this.tileSize
    }

    canonicalLeft = normalizeToCenter(canonicalLeft)
    canonicalTop = normalizeToCenter(canonicalTop)

    // Update canonical object with all transforms
    canonical.set({
      left: canonicalLeft,
      top: canonicalTop,
      scaleX: newScaleX,
      scaleY: newScaleY,
      angle: proxy.angle,
      flipX: proxy.flipX,
      flipY: proxy.flipY,
      skewX: proxy.skewX,
      skewY: proxy.skewY,
    })

    // Update proxy metadata for future syncs
    proxy.proxyMetadata.sizeAdjust = [newLeftAdjust, newTopAdjust]
    proxy.proxyMetadata.baseScale = [newScaleX, newScaleY]

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
    const [baseWidth, baseHeight] = proxy.proxyMetadata.baseSize

    // Get canonical scale
    const scaleX = canonical.scaleX || 1
    const scaleY = canonical.scaleY || 1

    // Calculate minimum base size needed to achieve MIN_PROXY_SIZE after scaling
    const minBaseWidth = MIN_PROXY_SIZE / scaleX
    const minBaseHeight = MIN_PROXY_SIZE / scaleY
    const proxyBaseWidth = Math.max(baseWidth, minBaseWidth)
    const proxyBaseHeight = Math.max(baseHeight, minBaseHeight)

    // Center the enlarged proxy over the actual object
    const leftAdjust = ((proxyBaseWidth - baseWidth) * scaleX) / 2
    const topAdjust = ((proxyBaseHeight - baseHeight) * scaleY) / 2

    // Update proxy to match canonical transforms
    proxy.set({
      left: (canonical.left || 0) + offsetX - leftAdjust,
      top: (canonical.top || 0) + offsetY - topAdjust,
      width: proxyBaseWidth,
      height: proxyBaseHeight,
      scaleX: scaleX,
      scaleY: scaleY,
      angle: canonical.angle,
      flipX: canonical.flipX,
      flipY: canonical.flipY,
      skewX: canonical.skewX,
      skewY: canonical.skewY,
    })

    // Update metadata
    proxy.proxyMetadata.sizeAdjust = [leftAdjust, topAdjust]
    proxy.proxyMetadata.baseScale = [scaleX, scaleY]

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
