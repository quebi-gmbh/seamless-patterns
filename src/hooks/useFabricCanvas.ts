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
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          }

          ctx.restore();
        }

        // Always re-render canonical objects in correct z-order from the store
        // Fabric renders objects in its own order, but we need to respect canonicalStore.insertionOrder
        // This ensures z-order changes are reflected correctly
        const highlightedIds = virtualRenderer.getHighlightedMirrorGroupIds();
        for (const obj of canonicalStore.getAll()) {
          if (obj.visible !== false && obj.tiledMetadata) {
            // Apply glow effect and scale for highlighted objects
            const isHighlighted =
              highlightedIds.size > 0 &&
              highlightedIds.has(obj.tiledMetadata.mirrorGroupId);

            if (isHighlighted) {
              ctx.save();
              ctx.shadowColor = "rgba(45, 212, 168, 0.8)";
              ctx.shadowBlur = 5;

              // For small objects, draw a minimum-size glow rect behind
              const bounds = obj.getBoundingRect();
              const minSize = 24;
              if (bounds.width < minSize && bounds.height < minSize) {
                const centerX = bounds.left + bounds.width / 2;
                const centerY = bounds.top + bounds.height / 2;
                const rectWidth = Math.max(bounds.width, minSize);
                const rectHeight = Math.max(bounds.height, minSize);

                ctx.fillStyle = "rgba(45, 212, 168, 0.3)";
                ctx.beginPath();
                ctx.roundRect(
                  centerX - rectWidth / 2,
                  centerY - rectHeight / 2,
                  rectWidth,
                  rectHeight,
                  4
                );
                ctx.fill();
              }
            }

            obj.render(ctx);

            if (isHighlighted) {
              ctx.restore();
            }
          }
        }

        // Render the 24 virtual copies around each canonical object
        virtualRenderer.renderVirtualCopies(ctx, canonicalStore.getAll());

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
