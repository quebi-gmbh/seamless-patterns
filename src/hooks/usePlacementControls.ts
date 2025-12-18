import { useEffect, useCallback, useRef } from 'react'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'
import type { UndoRedoManager } from '../core/UndoRedoManager'
import type { ObjectSnapshot } from '../core/commands/types'
import { TransformCommand } from '../core/commands/TransformCommand'
import { captureObjectSnapshot } from '../core/commands/utils'

interface PlacementControlsOptions {
  canvas: Canvas | null
  selectedObject: ExtendedFabricObject | null
  snapToGrid: boolean
  gridSize: number
  enabled: boolean
  undoRedoManager?: UndoRedoManager | null
}

export function usePlacementControls({
  canvas,
  selectedObject,
  snapToGrid,
  gridSize,
  enabled,
  undoRedoManager,
}: PlacementControlsOptions) {
  // Track before state for panel-driven changes
  const beforeSnapshotRef = useRef<ObjectSnapshot | null>(null)

  /**
   * Snap a value to the nearest grid point
   */
  const snapValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value
      return Math.round(value / gridSize) * gridSize
    },
    [snapToGrid, gridSize]
  )

  /**
   * Capture snapshot before making changes
   */
  const captureBeforeState = useCallback(() => {
    if (!selectedObject || !undoRedoManager) return
    const canonicalStore = undoRedoManager.getDependencies().canonicalStore
    beforeSnapshotRef.current = captureObjectSnapshot(selectedObject, canonicalStore)
  }, [selectedObject, undoRedoManager])

  /**
   * Create undo command if state changed
   */
  const createUndoCommand = useCallback(() => {
    if (!selectedObject || !undoRedoManager || !beforeSnapshotRef.current) return
    if (undoRedoManager.isInTransaction()) return

    const mirrorGroupId = selectedObject.tiledMetadata?.mirrorGroupId
    if (!mirrorGroupId) return

    const canonicalStore = undoRedoManager.getDependencies().canonicalStore
    const afterSnapshot = captureObjectSnapshot(selectedObject, canonicalStore)

    // Check if anything changed
    const b = beforeSnapshotRef.current.properties
    const a = afterSnapshot.properties
    const hasChanged = b.left !== a.left || b.top !== a.top ||
      b.scaleX !== a.scaleX || b.scaleY !== a.scaleY ||
      b.angle !== a.angle || b.flipX !== a.flipX || b.flipY !== a.flipY

    if (hasChanged) {
      const command = new TransformCommand(
        mirrorGroupId,
        beforeSnapshotRef.current,
        afterSnapshot,
        undoRedoManager.getDependencies()
      )
      undoRedoManager.execute(command)
    }

    beforeSnapshotRef.current = null
  }, [selectedObject, undoRedoManager])

  /**
   * Update object position with snap-to-grid support
   */
  const updatePosition = useCallback(
    (x: number, y: number) => {
      if (!canvas || !selectedObject) return

      captureBeforeState()

      const snappedX = snapValue(x)
      const snappedY = snapValue(y)

      selectedObject.set({
        left: snappedX,
        top: snappedY,
      })

      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })

      createUndoCommand()
    },
    [canvas, selectedObject, snapValue, captureBeforeState, createUndoCommand]
  )

  /**
   * Update object rotation
   */
  const updateRotation = useCallback(
    (angle: number) => {
      if (!canvas || !selectedObject) return

      captureBeforeState()

      // Normalize angle to 0-360 range
      const normalizedAngle = ((angle % 360) + 360) % 360

      selectedObject.set({ angle: normalizedAngle })
      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })

      createUndoCommand()
    },
    [canvas, selectedObject, captureBeforeState, createUndoCommand]
  )

  /**
   * Update object scale
   */
  const updateScale = useCallback(
    (scaleX: number, scaleY: number) => {
      if (!canvas || !selectedObject) return

      captureBeforeState()

      selectedObject.set({
        scaleX: Math.max(0.1, scaleX),
        scaleY: Math.max(0.1, scaleY),
      })

      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })

      createUndoCommand()
    },
    [canvas, selectedObject, captureBeforeState, createUndoCommand]
  )

  /**
   * Update object flip (mirror)
   */
  const updateFlip = useCallback(
    (flipX: boolean, flipY: boolean) => {
      if (!canvas || !selectedObject) return

      captureBeforeState()

      selectedObject.set({ flipX, flipY })
      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })

      createUndoCommand()
    },
    [canvas, selectedObject, captureBeforeState, createUndoCommand]
  )

  /**
   * Handle keyboard shortcuts for nudging objects
   */
  useEffect(() => {
    if (!enabled || !canvas || !selectedObject) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if an object is selected and no input is focused
      const activeElement = document.activeElement
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }

      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0

      switch (e.key) {
        case 'ArrowLeft':
          dx = -step
          e.preventDefault()
          break
        case 'ArrowRight':
          dx = step
          e.preventDefault()
          break
        case 'ArrowUp':
          dy = -step
          e.preventDefault()
          break
        case 'ArrowDown':
          dy = step
          e.preventDefault()
          break
        default:
          return
      }

      const currentX = selectedObject.left || 0
      const currentY = selectedObject.top || 0

      updatePosition(currentX + dx, currentY + dy)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, canvas, selectedObject, updatePosition])

  return {
    updatePosition,
    updateRotation,
    updateScale,
    updateFlip,
    snapValue,
  }
}
