import { useEffect, useCallback } from 'react'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'

interface PlacementControlsOptions {
  canvas: Canvas | null
  selectedObject: ExtendedFabricObject | null
  snapToGrid: boolean
  gridSize: number
  enabled: boolean
}

export function usePlacementControls({
  canvas,
  selectedObject,
  snapToGrid,
  gridSize,
  enabled,
}: PlacementControlsOptions) {
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
   * Update object position with snap-to-grid support
   */
  const updatePosition = useCallback(
    (x: number, y: number) => {
      if (!canvas || !selectedObject) return

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
    },
    [canvas, selectedObject, snapValue]
  )

  /**
   * Update object rotation
   */
  const updateRotation = useCallback(
    (angle: number) => {
      if (!canvas || !selectedObject) return

      // Normalize angle to 0-360 range
      const normalizedAngle = ((angle % 360) + 360) % 360

      selectedObject.set({ angle: normalizedAngle })
      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })
    },
    [canvas, selectedObject]
  )

  /**
   * Update object scale
   */
  const updateScale = useCallback(
    (scaleX: number, scaleY: number) => {
      if (!canvas || !selectedObject) return

      selectedObject.set({
        scaleX: Math.max(0.1, scaleX),
        scaleY: Math.max(0.1, scaleY),
      })

      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })
    },
    [canvas, selectedObject]
  )

  /**
   * Update object flip (mirror)
   */
  const updateFlip = useCallback(
    (flipX: boolean, flipY: boolean) => {
      if (!canvas || !selectedObject) return

      selectedObject.set({ flipX, flipY })
      selectedObject.setCoords()
      canvas.requestRenderAll()

      // Trigger object:modified event to sync mirrors
      canvas.fire('object:modified', { target: selectedObject })
    },
    [canvas, selectedObject]
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
