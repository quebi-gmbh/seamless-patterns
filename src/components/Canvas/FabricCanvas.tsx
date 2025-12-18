import { useRef, useEffect } from 'react'
import { useFabricCanvas, type VirtualTilingContext, type LayerBackground } from '../../hooks/useFabricCanvas'

interface FabricCanvasProps {
  className?: string
  visible?: boolean
  tileSize?: number
  zoom?: number
  onCanvasReady?: (canvas: import('fabric').Canvas, virtualTilingContext: VirtualTilingContext) => void
  onAfterRender?: () => void
  layerBackgrounds?: LayerBackground[]
}

export function FabricCanvas({
  className,
  visible = true,
  tileSize = 256,
  zoom = 1,
  onCanvasReady,
  onAfterRender,
  layerBackgrounds
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { fabricCanvas, virtualTilingContext } = useFabricCanvas(canvasRef, {
    tileSize,
    onAfterRender,
    layerBackgrounds
  })

  useEffect(() => {
    if (fabricCanvas && onCanvasReady) {
      onCanvasReady(fabricCanvas, virtualTilingContext)
    }
  }, [fabricCanvas, virtualTilingContext, onCanvasReady])

  // Apply zoom by resizing canvas and using Fabric's zoom
  // This gives true HD rendering at higher zoom levels
  useEffect(() => {
    if (!fabricCanvas) return

    const baseSize = tileSize * 3 // 768 for 256 tile size
    const zoomedSize = baseSize * zoom

    // Resize canvas to zoomed dimensions (both backstore and CSS)
    fabricCanvas.setDimensions({ width: zoomedSize, height: zoomedSize })

    // Set Fabric's zoom level - this scales all object rendering
    fabricCanvas.setZoom(zoom)

    // Store zoom on canvas for virtual rendering to access
    ;(fabricCanvas as any)._customZoom = zoom

    fabricCanvas.requestRenderAll()
  }, [fabricCanvas, zoom, tileSize])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
