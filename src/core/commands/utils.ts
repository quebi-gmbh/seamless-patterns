import type { CanonicalObjectStore } from '../CanonicalObjectStore'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { ObjectSnapshot } from './types'

/**
 * Capture a snapshot of an object's current state for undo/redo
 */
export function captureObjectSnapshot(
  obj: ExtendedFabricObject,
  store: CanonicalObjectStore
): ObjectSnapshot {
  const mirrorGroupId = obj.tiledMetadata?.mirrorGroupId || ''

  return {
    mirrorGroupId,
    layerId: obj.layerId,
    properties: {
      left: obj.left || 0,
      top: obj.top || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      angle: obj.angle || 0,
      flipX: obj.flipX || false,
      flipY: obj.flipY || false,
      fill: typeof obj.fill === 'string' ? obj.fill : null,
      stroke: typeof obj.stroke === 'string' ? obj.stroke : null,
      strokeWidth: obj.strokeWidth,
      opacity: obj.opacity,
      width: obj.width,
      height: obj.height,
      radius: (obj as any).radius,
    },
    zOrderIndex: store.getZOrderIndex(mirrorGroupId),
    entityGroupId: obj.tiledMetadata?.entityGroupId,
  }
}

/**
 * Check if two snapshots have different transform properties
 */
export function hasTransformChanged(before: ObjectSnapshot, after: ObjectSnapshot): boolean {
  const b = before.properties
  const a = after.properties

  return (
    b.left !== a.left ||
    b.top !== a.top ||
    b.scaleX !== a.scaleX ||
    b.scaleY !== a.scaleY ||
    b.angle !== a.angle ||
    b.flipX !== a.flipX ||
    b.flipY !== a.flipY
  )
}

/**
 * Check if two snapshots have different property values (fill, stroke, etc.)
 */
export function hasPropertiesChanged(before: ObjectSnapshot, after: ObjectSnapshot): boolean {
  const b = before.properties
  const a = after.properties

  return (
    b.fill !== a.fill ||
    b.stroke !== a.stroke ||
    b.strokeWidth !== a.strokeWidth ||
    b.opacity !== a.opacity
  )
}
