import type { Command, CommandDependencies } from './types'

/**
 * Command for property changes: fill, stroke, strokeWidth, opacity.
 */
export class PropertyCommand implements Command {
  readonly type = 'property'
  readonly description: string
  readonly timestamp: number

  constructor(
    private mirrorGroupId: string,
    private propertyName: string,
    private beforeValue: unknown,
    private afterValue: unknown,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = `Change ${this.getPropertyDisplayName()}`
  }

  private getPropertyDisplayName(): string {
    const nameMap: Record<string, string> = {
      fill: 'fill color',
      stroke: 'stroke color',
      strokeWidth: 'stroke width',
      opacity: 'opacity',
    }
    return nameMap[this.propertyName] || this.propertyName
  }

  execute(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set({ [this.propertyName]: this.afterValue })
    this.deps.canvas.requestRenderAll()
  }

  undo(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set({ [this.propertyName]: this.beforeValue })
    this.deps.canvas.requestRenderAll()
  }

  canMergeWith(_other: Command): boolean {
    // Don't merge property commands - each change should be separately undoable
    return false
  }
}

/**
 * Command for multiple property changes at once (e.g., from PropertiesPanel)
 */
export class MultiPropertyCommand implements Command {
  readonly type = 'property'
  readonly description: string
  readonly timestamp: number

  constructor(
    private mirrorGroupId: string,
    private beforeValues: Record<string, unknown>,
    private afterValues: Record<string, unknown>,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    const keys = Object.keys(afterValues)
    this.description =
      keys.length === 1 ? `Change ${keys[0]}` : `Change ${keys.length} properties`
  }

  execute(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set(this.afterValues)
    this.deps.canvas.requestRenderAll()
  }

  undo(): void {
    const canonical = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (!canonical) return

    canonical.set(this.beforeValues)
    this.deps.canvas.requestRenderAll()
  }
}
