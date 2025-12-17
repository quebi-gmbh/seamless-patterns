import { useEffect, useRef, useCallback, useState } from 'react'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'

interface ZoomViewOptions {
  fabricCanvas: Canvas | null
  zoomLevel: number
  followMode: 'cursor' | 'object' | 'manual'
  selectedObject: ExtendedFabricObject | null
  enabled: boolean
}

export function useZoomView({
  fabricCanvas,
  zoomLevel,
  followMode,
  selectedObject,
  enabled,
}: ZoomViewOptions) {
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [centerPoint, setCenterPoint] = useState({ x: 128, y: 128 })
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRenderTime = useRef(0)

  /**
   * Extract and render a zoomed region from the Fabric canvas
   */
  const renderZoom = useCallback(() => {
    if (!fabricCanvas || !zoomCanvasRef.current || !enabled) return

    // Throttle rendering to max 30fps to prevent flashing
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current
    if (timeSinceLastRender < 33) {
      // Less than 33ms since last render, schedule for later
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
      renderTimeoutRef.current = setTimeout(renderZoom, 33 - timeSinceLastRender)
      return
    }

    lastRenderTime.current = now

    const zoomCanvas = zoomCanvasRef.current
    const ctx = zoomCanvas.getContext('2d')
    if (!ctx) return

    // Calculate source region to extract (in Fabric canvas coordinates)
    // Account for device pixel ratio - Fabric's canvas element is scaled by the retina multiplier
    const retinaScaling = fabricCanvas.getRetinaScaling()
    const viewportSize = 200 / zoomLevel // Size of area to extract (in logical pixels)
    const sourceX = (centerPoint.x - viewportSize / 2) * retinaScaling
    const sourceY = (centerPoint.y - viewportSize / 2) * retinaScaling
    const scaledViewportSize = viewportSize * retinaScaling

    // Render the zoomed region from a canvas or image source
    const renderWithImage = (img: CanvasImageSource) => {
      // Clear zoom canvas
      ctx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height)

      // Draw the zoomed portion
      ctx.imageSmoothingEnabled = false // Pixelated look for crisp zoom
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        scaledViewportSize,
        scaledViewportSize,
        0,
        0,
        200,
        200
      )

      // Draw pixel grid if zoom is high enough
      if (zoomLevel >= 3) {
        const gridStep = zoomLevel
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 1

        // Vertical lines
        for (let x = 0; x <= 200; x += gridStep) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, 200)
          ctx.stroke()
        }

        // Horizontal lines
        for (let y = 0; y <= 200; y += gridStep) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(200, y)
          ctx.stroke()
        }
      }

      // Draw crosshair at center
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(100 - 10, 100)
      ctx.lineTo(100 + 10, 100)
      ctx.moveTo(100, 100 - 10)
      ctx.lineTo(100, 100 + 10)
      ctx.stroke()
    }

    // Get the actual canvas element (not Fabric's toDataURL which misses virtual copies)
    // The virtual copies are drawn directly to the canvas context in after:render,
    // so we need to capture the DOM element which includes them
    try {
      const canvasElement = fabricCanvas.getElement()
      if (canvasElement) {
        // Use the canvas element directly as the image source
        // This captures everything including virtual copies drawn after Fabric renders
        renderWithImage(canvasElement)
      }
    } catch (err) {
      console.error('Failed to render zoom view:', err)
    }
  }, [fabricCanvas, enabled, zoomLevel, centerPoint])

  /**
   * Update center point based on follow mode
   */
  const updateCenterPoint = useCallback(() => {
    if (!fabricCanvas || !enabled) return

    if (followMode === 'object' && selectedObject) {
      // Follow selected object
      const objCenterX = (selectedObject.left || 0) + ((selectedObject.width || 0) * (selectedObject.scaleX || 1)) / 2
      const objCenterY = (selectedObject.top || 0) + ((selectedObject.height || 0) * (selectedObject.scaleY || 1)) / 2

      setCenterPoint({ x: objCenterX, y: objCenterY })
    }
    // For cursor mode, center point is updated by mouse move handler
    // For manual mode, center point is controlled by user
  }, [fabricCanvas, enabled, followMode, selectedObject])

  /**
   * Handle mouse move on Fabric canvas (for cursor follow mode)
   * Throttled to prevent excessive updates
   */
  useEffect(() => {
    if (!fabricCanvas || !enabled || followMode !== 'cursor') return

    let lastUpdate = 0
    const handleMouseMove = (e: any) => {
      const now = Date.now()
      // Throttle to max 30 updates per second
      if (now - lastUpdate < 33) return

      lastUpdate = now
      const pointer = fabricCanvas.getViewportPoint(e.e)
      setCenterPoint({ x: pointer.x, y: pointer.y })
    }

    fabricCanvas.on('mouse:move', handleMouseMove)

    return () => {
      fabricCanvas.off('mouse:move', handleMouseMove)
    }
  }, [fabricCanvas, enabled, followMode])

  /**
   * Render zoom view when center point changes
   */
  useEffect(() => {
    if (!enabled) return
    renderZoom()
  }, [centerPoint, zoomLevel, enabled, renderZoom])

  /**
   * Re-render zoom view when canvas objects change
   */
  useEffect(() => {
    if (!fabricCanvas || !enabled) return

    const handleCanvasChange = () => {
      renderZoom()
    }

    // Listen to canvas events (but not after:render which fires too often)
    fabricCanvas.on('object:modified', handleCanvasChange)
    fabricCanvas.on('object:added', handleCanvasChange)
    fabricCanvas.on('object:removed', handleCanvasChange)

    // Initial render
    renderZoom()

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
      fabricCanvas.off('object:modified', handleCanvasChange)
      fabricCanvas.off('object:added', handleCanvasChange)
      fabricCanvas.off('object:removed', handleCanvasChange)
    }
  }, [fabricCanvas, enabled, renderZoom])

  /**
   * Update center point when follow mode or selected object changes
   */
  useEffect(() => {
    updateCenterPoint()
  }, [updateCenterPoint])

  /**
   * Manual pan control
   */
  const panTo = useCallback((x: number, y: number) => {
    setCenterPoint({ x, y })
  }, [])

  return {
    zoomCanvasRef,
    centerPoint,
    panTo,
  }
}
