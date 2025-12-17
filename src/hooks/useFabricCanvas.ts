import { useEffect, useState, useMemo, useRef } from 'react'
import { Canvas } from 'fabric'
import { CanonicalObjectStore } from '../core/CanonicalObjectStore'
import { VirtualRenderingEngine } from '../core/VirtualRenderingEngine'
import { HitTestInterceptor } from '../core/HitTestInterceptor'
import { SelectionProxyManager } from '../core/SelectionProxyManager'

// Canvas is 3x3 grid of tiles
const GRID_SIZE = 3
const DEFAULT_TILE_SIZE = 256
const CANVAS_SIZE = GRID_SIZE * DEFAULT_TILE_SIZE // 768px

export interface VirtualTilingContext {
  canonicalStore: CanonicalObjectStore
  virtualRenderer: VirtualRenderingEngine
  hitTestInterceptor: HitTestInterceptor
  selectionProxyManager: SelectionProxyManager | null
}

export interface UseFabricCanvasOptions {
  tileSize?: number
  onAfterRender?: () => void
}

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseFabricCanvasOptions = {}
) {
  const { tileSize = DEFAULT_TILE_SIZE, onAfterRender } = options
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null)

  // Store callback in ref to avoid triggering canvas recreation
  const onAfterRenderRef = useRef(onAfterRender)
  useEffect(() => {
    onAfterRenderRef.current = onAfterRender
  }, [onAfterRender])

  // Create stores and engines that persist across renders
  const canonicalStore = useMemo(() => new CanonicalObjectStore(), [])
  const virtualRenderer = useMemo(
    () => new VirtualRenderingEngine(tileSize),
    []
  )
  const hitTestInterceptor = useMemo(
    () => new HitTestInterceptor(tileSize, canonicalStore),
    [canonicalStore]
  )

  // SelectionProxyManager needs the canvas, so it's created after canvas is ready
  const [selectionProxyManager, setSelectionProxyManager] =
    useState<SelectionProxyManager | null>(null)

  // Update tile size when it changes
  useEffect(() => {
    virtualRenderer.setTileSize(tileSize)
    hitTestInterceptor.setTileSize(tileSize)
    selectionProxyManager?.setTileSize(tileSize)
  }, [tileSize, virtualRenderer, hitTestInterceptor, selectionProxyManager])

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
      uniformScaling: true,
    })

    // Create SelectionProxyManager now that canvas is available
    const proxyManager = new SelectionProxyManager(
      canvas,
      canonicalStore,
      tileSize
    )
    setSelectionProxyManager(proxyManager)

    // Setup after:render handler for virtual tiling
    // This is the ONLY place where virtual copies should be drawn
    const handleAfterRender = () => {
      const ctx = canvas.getContext()
      if (ctx) {
        // Render the 8 virtual copies around each canonical object
        virtualRenderer.renderVirtualCopies(ctx, canonicalStore.getAll())
      }
      // Notify listeners that rendering is complete (including virtual copies)
      onAfterRenderRef.current?.()
    }

    canvas.on('after:render', handleAfterRender)

    setFabricCanvas(canvas)

    return () => {
      canvas.off('after:render', handleAfterRender)
      proxyManager.clearAll()
      canvas.dispose()
    }
  }, [canvasRef, canonicalStore, virtualRenderer, tileSize])

  // Create context object for virtual tiling
  const virtualTilingContext: VirtualTilingContext = useMemo(
    () => ({
      canonicalStore,
      virtualRenderer,
      hitTestInterceptor,
      selectionProxyManager,
    }),
    [canonicalStore, virtualRenderer, hitTestInterceptor, selectionProxyManager]
  )

  return { fabricCanvas, virtualTilingContext }
}
