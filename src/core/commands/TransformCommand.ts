import type { Command, CommandDependencies, ObjectSnapshot } from './types'

/**
 * Command for transform operations: move, scale, rotate, flip.
 * Supports merging consecutive transforms on the same object within a time window.
 */
export class TransformCommand implements Command {
  readonly type = 'transform'
  readonly description: string
  readonly timestamp: number

  private static MERGE_WINDOW_MS = 500

  constructor(
    private mirrorGroupId: string,
    private beforeState: ObjectSnapshot,
    private afterState: ObjectSnapshot,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = 'Transform object'
  }

  execute(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set({
      left: this.afterState.properties.left,
      top: this.afterState.properties.top,
      scaleX: this.afterState.properties.scaleX,
      scaleY: this.afterState.properties.scaleY,
      angle: this.afterState.properties.angle,
      flipX: this.afterState.properties.flipX,
      flipY: this.afterState.properties.flipY,
    })
    canonical.setCoords()

    // Sync proxy if exists
    this.deps.selectionProxyManager?.syncCanonicalToProxy(this.mirrorGroupId)
    this.deps.canvas.requestRenderAll()
  }

  undo(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set({
      left: this.beforeState.properties.left,
      top: this.beforeState.properties.top,
      scaleX: this.beforeState.properties.scaleX,
      scaleY: this.beforeState.properties.scaleY,
      angle: this.beforeState.properties.angle,
      flipX: this.beforeState.properties.flipX,
      flipY: this.beforeState.properties.flipY,
    })
    canonical.setCoords()

    this.deps.selectionProxyManager?.syncCanonicalToProxy(this.mirrorGroupId)
    this.deps.canvas.requestRenderAll()
  }

  canMergeWith(other: Command): boolean {
    if (!(other instanceof TransformCommand)) return false
    if (other.mirrorGroupId !== this.mirrorGroupId) return false

    // Only merge if within time window
    return this.timestamp - other.timestamp < TransformCommand.MERGE_WINDOW_MS
  }

  mergeWith(other: Command): TransformCommand {
    if (!(other instanceof TransformCommand)) {
      throw new Error('Cannot merge with non-TransformCommand')
    }

    // Keep other's beforeState (older), use this afterState (newer)
    return new TransformCommand(
      this.mirrorGroupId,
      other.beforeState,
      this.afterState,
      this.deps
    )
  }
}
