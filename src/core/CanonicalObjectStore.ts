import type { ExtendedFabricObject } from '../types/FabricExtensions'

/**
 * Centralized storage for canonical objects (1 per entity).
 * Replaces the 25-object arrays previously managed by TilingEngine.
 */
export class CanonicalObjectStore {
  private objects: Map<string, ExtendedFabricObject> = new Map() // mirrorGroupId → object
  private insertionOrder: string[] = [] // Track z-order
  private cachedReversed: ExtendedFabricObject[] | null = null // Cache for getAllReversed
  private changeListeners: Array<() => void> = [] // Listeners for change events

  /**
   * Invalidate cached data (call when store changes)
   */
  private invalidateCache(): void {
    this.cachedReversed = null
    // Notify listeners that store changed
    this.changeListeners.forEach((listener) => listener())
  }

  /**
   * Register a listener for store changes
   */
  onChanged(listener: () => void): () => void {
    this.changeListeners.push(listener)
    return () => {
      const index = this.changeListeners.indexOf(listener)
      if (index > -1) {
        this.changeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Add a canonical object to the store
   */
  add(obj: ExtendedFabricObject, mirrorGroupId: string): void {
    if (this.objects.has(mirrorGroupId)) {
      // Replace existing - maintain position in insertion order
      this.objects.set(mirrorGroupId, obj)
    } else {
      this.objects.set(mirrorGroupId, obj)
      this.insertionOrder.push(mirrorGroupId)
    }
    this.invalidateCache()
  }

  /**
   * Get a canonical object by mirrorGroupId
   */
  get(mirrorGroupId: string): ExtendedFabricObject | null {
    return this.objects.get(mirrorGroupId) || null
  }

  /**
   * Remove a canonical object from the store
   */
  remove(mirrorGroupId: string): void {
    this.objects.delete(mirrorGroupId)
    const index = this.insertionOrder.indexOf(mirrorGroupId)
    if (index > -1) {
      this.insertionOrder.splice(index, 1)
    }
    this.invalidateCache()
  }

  /**
   * Get all canonical objects in z-order (bottom to top)
   */
  getAll(): ExtendedFabricObject[] {
    return this.insertionOrder
      .map((id) => this.objects.get(id))
      .filter((obj): obj is ExtendedFabricObject => obj !== undefined)
  }

  /**
   * Get all canonical objects for a specific layer
   */
  getByLayer(layerId: string): ExtendedFabricObject[] {
    return this.getAll().filter((obj) => obj.layerId === layerId)
  }

  /**
   * Get all visible canonical objects (respecting layer visibility)
   */
  getVisible(): ExtendedFabricObject[] {
    return this.getAll().filter((obj) => obj.visible !== false)
  }

  /**
   * Check if a mirrorGroupId exists in the store
   */
  has(mirrorGroupId: string): boolean {
    return this.objects.has(mirrorGroupId)
  }

  /**
   * Get the count of canonical objects
   */
  get size(): number {
    return this.objects.size
  }

  /**
   * Clear all objects from the store
   */
  clear(): void {
    this.objects.clear()
    this.insertionOrder = []
    this.invalidateCache()
  }

  /**
   * Move an object to the front (top of z-order)
   */
  bringToFront(mirrorGroupId: string): void {
    const index = this.insertionOrder.indexOf(mirrorGroupId)
    if (index > -1) {
      this.insertionOrder.splice(index, 1)
      this.insertionOrder.push(mirrorGroupId)
      this.invalidateCache()
    }
  }

  /**
   * Move an object to the back (bottom of z-order)
   */
  sendToBack(mirrorGroupId: string): void {
    const index = this.insertionOrder.indexOf(mirrorGroupId)
    if (index > -1) {
      this.insertionOrder.splice(index, 1)
      this.insertionOrder.unshift(mirrorGroupId)
      this.invalidateCache()
    }
  }

  /**
   * Move an object forward one position in z-order
   */
  bringForward(mirrorGroupId: string): void {
    const index = this.insertionOrder.indexOf(mirrorGroupId)
    if (index > -1 && index < this.insertionOrder.length - 1) {
      ;[this.insertionOrder[index], this.insertionOrder[index + 1]] = [
        this.insertionOrder[index + 1],
        this.insertionOrder[index],
      ]
      this.invalidateCache()
    }
  }

  /**
   * Move an object backward one position in z-order
   */
  sendBackward(mirrorGroupId: string): void {
    const index = this.insertionOrder.indexOf(mirrorGroupId)
    if (index > 0) {
      ;[this.insertionOrder[index], this.insertionOrder[index - 1]] = [
        this.insertionOrder[index - 1],
        this.insertionOrder[index],
      ]
      this.invalidateCache()
    }
  }

  /**
   * Get objects in reverse z-order (top to bottom) - useful for hit testing
   * Uses cached array to avoid re-allocation on every call
   */
  getAllReversed(): ExtendedFabricObject[] {
    if (!this.cachedReversed) {
      this.cachedReversed = [...this.getAll()].reverse()
    }
    return this.cachedReversed
  }
}
