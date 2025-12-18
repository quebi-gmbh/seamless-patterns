import * as fabric from 'fabric'
import type { Command, CommandDependencies, SerializedObjectData } from './types'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'

/**
 * Command for object deletion operations.
 * Stores the serialized object to enable recreation on undo.
 */
export class DeleteCommand implements Command {
  readonly type = 'delete'
  readonly description: string
  readonly timestamp: number

  private serializedData: SerializedObjectData

  constructor(
    private mirrorGroupId: string,
    objectToDelete: ExtendedFabricObject,
    private deps: CommandDependencies
  ) {
    this.timestamp = Date.now()
    this.description = `Delete ${objectToDelete.type || 'object'}`

    // Capture full state before deletion
    this.serializedData = {
      mirrorGroupId,
      layerId: objectToDelete.layerId || '',
      zOrderIndex: deps.canonicalStore.getZOrderIndex(mirrorGroupId),
      fabricObjectJSON: JSON.stringify(objectToDelete.toObject([
        'tiledMetadata',
        'layerId',
        'id',
      ])),
      entityGroupId: objectToDelete.tiledMetadata?.entityGroupId,
    }
  }

  execute(): void {
    // Delete the object
    const obj = this.deps.canonicalStore.get(this.mirrorGroupId)
    if (obj) {
      this.deps.canvas.remove(obj)
      this.deps.canonicalStore.remove(this.mirrorGroupId)

      // Also remove any active proxy
      this.deps.selectionProxyManager?.removeProxy(this.mirrorGroupId)
    }
    this.deps.canvas.requestRenderAll()
  }

  async undo(): Promise<void> {
    // Recreate the object from serialized data
    const objectData = JSON.parse(this.serializedData.fabricObjectJSON)

    // Use fabric.util.enlivenObjects to recreate the object
    const objects = await fabric.util.enlivenObjects([objectData])
    if (objects.length === 0) return

    const recreatedObj = objects[0] as ExtendedFabricObject

    // Restore metadata
    recreatedObj.tiledMetadata = {
      isMirror: false,
      mirrorGroupId: this.mirrorGroupId,
      tilePosition: [0, 0],
      entityGroupId: this.serializedData.entityGroupId,
    }
    recreatedObj.layerId = this.serializedData.layerId

    // Make it non-selectable (canonical objects are selected via proxies)
    recreatedObj.set({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    })

    // Add to canonical store at original z-order position
    this.deps.canonicalStore.addAtIndex(
      recreatedObj,
      this.mirrorGroupId,
      this.serializedData.zOrderIndex
    )

    // Add to canvas
    this.deps.canvas.add(recreatedObj)
    this.deps.canvas.requestRenderAll()
  }
}
