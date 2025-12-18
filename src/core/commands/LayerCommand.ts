import type { Command, CommandDependencies } from './types'

/**
 * Command for moving an entity from one layer to another.
 */
export class LayerMoveCommand implements Command {
  readonly type = 'layer-move'
  readonly description: string
  readonly timestamp: number

  constructor(
    private mirrorGroupId: string,
    private fromLayerId: string,
    private toLayerId: string,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = 'Move to layer'
  }

  execute(): void {
    const obj = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (obj) {
      obj.layerId = this.toLayerId
      this.deps.canvas.requestRenderAll()
    }
  }

  undo(): void {
    const obj = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (obj) {
      obj.layerId = this.fromLayerId
      this.deps.canvas.requestRenderAll()
    }
  }
}

/**
 * Command for reordering layers.
 */
export class LayerReorderCommand implements Command {
  readonly type = 'layer-reorder'
  readonly description: string
  readonly timestamp: number

  constructor(
    private beforeOrder: string[], // Array of layer IDs in original order
    private afterOrder: string[],  // Array of layer IDs in new order
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = 'Reorder layers'
  }

  execute(): void {
    // Apply the new order to the layer manager
    this.applyLayerOrder(this.afterOrder)
  }

  undo(): void {
    // Restore the original order
    this.applyLayerOrder(this.beforeOrder)
  }

  private applyLayerOrder(order: string[]): void {
    // Update layer order property for each layer
    order.forEach((layerId, index) => {
      const layer = this.deps.layerManager.getLayer(layerId)
      if (layer) {
        this.deps.layerManager.updateLayer(layerId, { order: index })
      }
    })
    this.deps.canvas.requestRenderAll()
  }
}
