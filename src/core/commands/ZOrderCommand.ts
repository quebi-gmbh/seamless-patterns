import type { Command, CommandDependencies } from './types'

export type ZOrderOperation = 'front' | 'back' | 'forward' | 'backward'

/**
 * Command for z-order changes: bring to front, send to back, etc.
 */
export class ZOrderCommand implements Command {
  readonly type = 'zorder'
  readonly description: string
  readonly timestamp: number

  constructor(
    private mirrorGroupId: string,
    private beforeIndex: number,
    private afterIndex: number,
    private operation: ZOrderOperation,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = this.getOperationDescription()
  }

  private getOperationDescription(): string {
    const descriptions: Record<ZOrderOperation, string> = {
      front: 'Bring to front',
      back: 'Send to back',
      forward: 'Bring forward',
      backward: 'Send backward',
    }
    return descriptions[this.operation]
  }

  execute(): void {
    // Set z-order to after index
    this.deps.canonicalStore.setZOrderIndex(this.mirrorGroupId, this.afterIndex)
    this.deps.canvas.requestRenderAll()
  }

  undo(): void {
    // Restore z-order to before index
    this.deps.canonicalStore.setZOrderIndex(this.mirrorGroupId, this.beforeIndex)
    this.deps.canvas.requestRenderAll()
  }
}
