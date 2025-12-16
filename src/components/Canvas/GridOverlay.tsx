import { useEffect } from 'react'
import type { Canvas } from 'fabric'
import { Line } from 'fabric'

interface GridOverlayProps {
  fabricCanvas: Canvas | null
  tileSize: number
}

export function GridOverlay({ fabricCanvas, tileSize }: GridOverlayProps) {
  useEffect(() => {
    if (!fabricCanvas) return

    // Remove existing grid lines
    const existingLines = fabricCanvas.getObjects().filter(
      (obj: any) => obj.gridLine === true
    )
    existingLines.forEach((line) => fabricCanvas.remove(line))

    // Draw vertical lines
    for (let x = 1; x < 3; x++) {
      const line = new Line([x * tileSize, 0, x * tileSize, tileSize * 3], {
        stroke: '#ffffff',
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      }) as any
      line.gridLine = true
      fabricCanvas.add(line)
    }

    // Draw horizontal lines
    for (let y = 1; y < 3; y++) {
      const line = new Line([0, y * tileSize, tileSize * 3, y * tileSize], {
        stroke: '#ffffff',
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      }) as any
      line.gridLine = true
      fabricCanvas.add(line)
    }

    // Initial render
    fabricCanvas.requestRenderAll()
  }, [fabricCanvas, tileSize])

  // Keep grid lines on top whenever objects are added/modified
  useEffect(() => {
    if (!fabricCanvas) return

    const bringGridToFront = () => {
      const gridLines = fabricCanvas.getObjects().filter((obj: any) => obj.gridLine)
      gridLines.forEach((line) => {
        fabricCanvas.bringObjectToFront(line)
      })
    }

    fabricCanvas.on('object:added', bringGridToFront)
    fabricCanvas.on('object:modified', bringGridToFront)

    return () => {
      fabricCanvas.off('object:added', bringGridToFront)
      fabricCanvas.off('object:modified', bringGridToFront)
    }
  }, [fabricCanvas])

  return null
}
