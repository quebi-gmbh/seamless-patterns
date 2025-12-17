import { useRef, useEffect } from 'react'
import { useFabricCanvas, type VirtualTilingContext } from '../../hooks/useFabricCanvas'

interface FabricCanvasProps {
  className?: string
  visible?: boolean
  tileSize?: number
  onCanvasReady?: (canvas: import('fabric').Canvas, virtualTilingContext: VirtualTilingContext) => void
  onAfterRender?: () => void
}

export function FabricCanvas({
  className,
  visible = true,
  tileSize = 256,
  onCanvasReady,
  onAfterRender
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { fabricCanvas, virtualTilingContext } = useFabricCanvas(canvasRef, {
    tileSize,
    onAfterRender
  })

  useEffect(() => {
    if (fabricCanvas && onCanvasReady) {
      onCanvasReady(fabricCanvas, virtualTilingContext)
    }
  }, [fabricCanvas, virtualTilingContext, onCanvasReady])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
