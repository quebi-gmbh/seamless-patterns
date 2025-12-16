import { useEffect, useState } from 'react'
import type { Canvas } from 'fabric'
import { TilingEngine } from '../core/TilingEngine'

export function useTilingEngine(
  fabricCanvas: Canvas | null,
  tileSize: number
) {
  const [tilingEngine, setTilingEngine] = useState<TilingEngine | null>(null)

  useEffect(() => {
    if (!fabricCanvas) return

    const engine = new TilingEngine(fabricCanvas, tileSize)
    setTilingEngine(engine)

    return () => {
      // Cleanup if needed
    }
  }, [fabricCanvas, tileSize])

  // Update tile size when it changes
  useEffect(() => {
    if (tilingEngine) {
      tilingEngine.updateTileSize(tileSize)
    }
  }, [tilingEngine, tileSize])

  return tilingEngine
}
