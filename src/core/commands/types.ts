import type { Canvas as FabricCanvasType } from 'fabric'
import type { CanonicalObjectStore } from '../CanonicalObjectStore'
import type { LayerManager } from '../LayerManager'
import type { SelectionProxyManager } from '../SelectionProxyManager'
import type { TilingEngine } from '../TilingEngine'

/**
 * Snapshot of an object's state for undo/redo
 */
export interface ObjectSnapshot {
  mirrorGroupId: string
  layerId?: string
  properties: {
    left: number
    top: number
    scaleX: number
    scaleY: number
    angle: number
    flipX: boolean
    flipY: boolean
    fill?: string | null
    stroke?: string | null
    strokeWidth?: number
    opacity?: number
    width?: number
    height?: number
    radius?: number
  }
  zOrderIndex: number
  entityGroupId?: string
}

/**
 * Serialized object data for recreation
 */
export interface SerializedObjectData {
  mirrorGroupId: string
  layerId: string
  zOrderIndex: number
  fabricObjectJSON: string
  entityGroupId?: string
}

/**
 * Dependencies required by commands to execute their operations
 */
export interface CommandDependencies {
  canvas: FabricCanvasType
  canonicalStore: CanonicalObjectStore
  layerManager: LayerManager
  selectionProxyManager: SelectionProxyManager | null
  tilingEngine: TilingEngine | null
  /** Callback to clear selection after undo/redo */
  clearSelection?: () => void
  /** Callback to trigger canvas re-render */
  requestRender?: () => void
}

/**
 * Base interface for all undoable commands
 */
export interface Command {
  /** Unique type identifier for the command */
  readonly type: string
  /** Human-readable description of the operation */
  readonly description: string
  /** Timestamp when command was created */
  readonly timestamp: number

  /**
   * Execute the command (apply the change / redo)
   */
  execute(): void | Promise<void>

  /**
   * Reverse the command (undo the change)
   */
  undo(): void | Promise<void>

  /**
   * Check if this command can be merged with another
   * Used for combining continuous operations (e.g., dragging)
   */
  canMergeWith?(other: Command): boolean

  /**
   * Merge this command with another, returning the combined command
   * The merged command should have this command's before state
   * and the other command's after state
   */
  mergeWith?(other: Command): Command
}

/**
 * Command types for type discrimination
 */
export type CommandType =
  | 'transform'
  | 'property'
  | 'create'
  | 'delete'
  | 'zorder'
  | 'layer-move'
  | 'layer-reorder'
  | 'batch'
