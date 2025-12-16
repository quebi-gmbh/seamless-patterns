import { useRef, useEffect } from 'react'
import { useFabricCanvas } from '../../hooks/useFabricCanvas'

interface FabricCanvasProps {
  className?: string
  visible?: boolean
  onCanvasReady?: (canvas: import('fabric').Canvas) => void
}

export function FabricCanvas({
  className,
  visible = true,
  onCanvasReady
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvas = useFabricCanvas(canvasRef)

  useEffect(() => {
    if (fabricCanvas && onCanvasReady) {
      onCanvasReady(fabricCanvas)
    }
  }, [fabricCanvas, onCanvasReady])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
