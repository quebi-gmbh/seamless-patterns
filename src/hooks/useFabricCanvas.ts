import { useEffect, useState } from 'react'
import { Canvas } from 'fabric'

// Fixed canvas size for drawing (3x3 grid of 256px tiles = 768px)
const CANVAS_SIZE = 768

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>
) {
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: '#1a1a25',
      selection: false, // Disable group selection initially
      preserveObjectStacking: true,
    })

    // Configure default object properties
    canvas.set({
      uniformScaling: true, // Enable uniform scaling by default to preserve aspect ratio
    })

    setFabricCanvas(canvas)

    return () => {
      canvas.dispose()
    }
  }, [canvasRef])

  return fabricCanvas
}
