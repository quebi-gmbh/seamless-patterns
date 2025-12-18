import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas } from "fabric";
import { CanonicalObjectStore } from "../core/CanonicalObjectStore";
import { VirtualRenderingEngine } from "../core/VirtualRenderingEngine";
import { HitTestInterceptor } from "../core/HitTestInterceptor";
import { SelectionProxyManager } from "../core/SelectionProxyManager";

// Canvas is 3x3 grid of tiles
const GRID_SIZE = 3;
const DEFAULT_TILE_SIZE = 256;
const CANVAS_SIZE = GRID_SIZE * DEFAULT_TILE_SIZE; // 768px

export interface VirtualTilingContext {
  canonicalStore: CanonicalObjectStore;
  virtualRenderer: VirtualRenderingEngine;
  hitTestInterceptor: HitTestInterceptor;
  selectionProxyManager: SelectionProxyManager | null;
}

export interface LayerBackground {
  order: number;
  backgroundColor: string;
  backgroundAlpha: number;
}

export interface UseFabricCanvasOptions {
  tileSize?: number;
  onAfterRender?: () => void;
  layerBackgrounds?: LayerBackground[];
}

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseFabricCanvasOptions = {}
) {
  const {
    tileSize = DEFAULT_TILE_SIZE,
    onAfterRender,
    layerBackgrounds,
  } = options;
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);

  // Store callback in ref to avoid triggering canvas recreation
  const onAfterRenderRef = useRef(onAfterRender);
  useEffect(() => {
    onAfterRenderRef.current = onAfterRender;
  }, [onAfterRender]);

  // Store layer backgrounds in ref to avoid triggering canvas recreation
  const layerBackgroundsRef = useRef(layerBackgrounds);
  useEffect(() => {
    layerBackgroundsRef.current = layerBackgrounds;
    // Trigger re-render when backgrounds change
    if (fabricCanvas) {
      fabricCanvas.requestRenderAll();
    }
  }, [layerBackgrounds, fabricCanvas]);

  // Create stores and engines that persist across renders
  const canonicalStore = useMemo(() => new CanonicalObjectStore(), []);
  const virtualRenderer = useMemo(
    () => new VirtualRenderingEngine(tileSize),
    []
  );
  const hitTestInterceptor = useMemo(
    () => new HitTestInterceptor(tileSize, canonicalStore),
    [canonicalStore]
  );

  // SelectionProxyManager needs the canvas, so it's created after canvas is ready
  const [selectionProxyManager, setSelectionProxyManager] =
    useState<SelectionProxyManager | null>(null);

  // Update tile size when it changes
  useEffect(() => {
    virtualRenderer.setTileSize(tileSize);
    hitTestInterceptor.setTileSize(tileSize);
    selectionProxyManager?.setTileSize(tileSize);
  }, [tileSize, virtualRenderer, hitTestInterceptor, selectionProxyManager]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: "#1a1a25",
      selection: false, // Disable group selection initially
      preserveObjectStacking: true,
      perPixelTargetFind: true, // Enable pixel-perfect hit detection
    });

    // Configure default object properties
    canvas.set({
      uniformScaling: true,
    });

    // Create SelectionProxyManager now that canvas is available
    const proxyManager = new SelectionProxyManager(
      canvas,
      canonicalStore,
      tileSize
    );
    setSelectionProxyManager(proxyManager);

    // Helper to convert hex color to rgba
    const hexToRgba = (hex: string, alpha: number): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Setup after:render handler for virtual tiling
    // This is the ONLY place where virtual copies should be drawn
    const handleAfterRender = () => {
      const ctx = canvas.getContext();
      if (ctx) {
        // Get current zoom level from canvas (set by FabricCanvas component)
        const zoom = (canvas as any)._customZoom || 1;
        const zoomedCanvasSize = CANVAS_SIZE * zoom;

        // Render layer backgrounds on top of canvas background but behind objects
        const backgrounds = layerBackgroundsRef.current;

        if (backgrounds && backgrounds.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";

          // Draw backgrounds in order (lowest layer first)
          const sortedBackgrounds = [...backgrounds].sort(
            (a, b) => a.order - b.order
          );
          for (const bg of sortedBackgrounds) {
            ctx.fillStyle = hexToRgba(bg.backgroundColor, bg.backgroundAlpha);
            ctx.fillRect(0, 0, zoomedCanvasSize, zoomedCanvasSize);
          }

          ctx.restore();
        }

        // Fabric has already rendered canonical objects with zoom applied via viewport transform.
        // We only need to render the 24 virtual copies around each canonical object.
        // Pass zoom so virtual renderer can apply correct offsets
        virtualRenderer.renderVirtualCopies(ctx, canonicalStore.getAll(), zoom);

        // Re-render active selection controls on top of virtual copies
        // This ensures selection bounding box is always visible above neighboring objects
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          // _renderControls expects untransformed context, which matches our state
          activeObject._renderControls(ctx);
        }
      }
      // Notify listeners that rendering is complete (including virtual copies)
      onAfterRenderRef.current?.();
    };

    canvas.on("after:render", handleAfterRender);

    setFabricCanvas(canvas);

    return () => {
      canvas.off("after:render", handleAfterRender);
      proxyManager.clearAll();
      canvas.dispose();
    };
  }, [canvasRef, canonicalStore, virtualRenderer, tileSize]);

  // Create context object for virtual tiling
  const virtualTilingContext: VirtualTilingContext = useMemo(
    () => ({
      canonicalStore,
      virtualRenderer,
      hitTestInterceptor,
      selectionProxyManager,
    }),
    [canonicalStore, virtualRenderer, hitTestInterceptor, selectionProxyManager]
  );

  return { fabricCanvas, virtualTilingContext };
}
