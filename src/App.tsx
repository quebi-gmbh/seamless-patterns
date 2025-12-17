import { useState, useRef, useEffect, useCallback } from 'react'
import type { Canvas as FabricCanvasType } from 'fabric'
import { Circle, Rect, FabricImage, loadSVGFromURL, util as fabricUtil, PencilBrush, ActiveSelection } from 'fabric'
import { Button } from 'react-aria-components'
import { MousePointer2, Brush, Eraser, Square, Circle as CircleIcon, FileUp } from 'lucide-react'
import { FabricCanvas } from './components/Canvas/FabricCanvas'
import { GridOverlay } from './components/Canvas/GridOverlay'
import { ZoomView } from './components/Canvas/ZoomView'
import { EntityPanel } from './components/Panels/EntityPanel'
import { LayerPanel } from './components/Panels/LayerPanel'
import { PlacementPanel } from './components/Panels/PlacementPanel'
import { PropertiesPanel } from './components/Panels/PropertiesPanel'
import { CollapsiblePanel } from './components/Panels/CollapsiblePanel'
import { ImportDialog } from './components/ImportDialog/ImportDialog'
import { SVGCodeDialog } from './components/SVGCodeDialog/SVGCodeDialog'
import { SVGEditDialog } from './components/SVGEditDialog/SVGEditDialog'
import { ExportDialog } from './components/ExportDialog/ExportDialog'
import { ProjectExportDialog } from './components/ProjectExportDialog/ProjectExportDialog'
import { RecoveryDialog } from './components/RecoveryDialog/RecoveryDialog'
import { useTilingEngine } from './hooks/useTilingEngine'
import { usePlacementControls } from './hooks/usePlacementControls'
import { LayerManager } from './core/LayerManager'
import { EntityGroupManager } from './core/EntityGroupManager'
import type { ExtendedFabricObject } from './types/FabricExtensions'
import type { VirtualTilingContext } from './hooks/useFabricCanvas'
import { exportProjectAsJSON, serializeProject } from './utils/projectExport'
import { importProjectFromFile, deserializeProject } from './utils/projectImport'
import { hasAutosave, loadFromLocalStorage, saveToLocalStorage, clearAutosave } from './utils/autoSave'

type Tool = 'brush' | 'eraser' | 'select' | 'rectangle' | 'circle' | 'svg'

// Fixed tile size for drawing - resolution setting only affects export quality
const DRAWING_TILE_SIZE = 256

function App() {
  const tileCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [brushSize, setBrushSize] = useState(8)
  const [color, setColor] = useState('#ff6b6b')
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvasType | null>(null)
  const [virtualTilingContext, setVirtualTilingContext] = useState<VirtualTilingContext | null>(null)
  const tilingEngine = useTilingEngine(fabricCanvas, DRAWING_TILE_SIZE)
  const [isDrawingShape, setIsDrawingShape] = useState(false)
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
  const [tempShape, setTempShape] = useState<any>(null)
  const [layerManager, setLayerManager] = useState<LayerManager | null>(null)
  const [entityGroupManager, setEntityGroupManager] = useState<EntityGroupManager | null>(null)
  const [currentLayerId, setCurrentLayerId] = useState<string>('')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isSVGCodeDialogOpen, setIsSVGCodeDialogOpen] = useState(false)
  const [editingSVGId, setEditingSVGId] = useState<string | null>(null)
  const [editingSVGCode, setEditingSVGCode] = useState<string>('')
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set())
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isProjectExportDialogOpen, setIsProjectExportDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [objectUpdateCounter, setObjectUpdateCounter] = useState(0)

  // Advanced placement state
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [gridSize, setGridSize] = useState(16)
  const [selectedObject, setSelectedObject] = useState<ExtendedFabricObject | null>(null)

  // Zoom view state
  const [showZoomView, setShowZoomView] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(3)
  const [followMode, setFollowMode] = useState<'cursor' | 'object' | 'manual'>('cursor')

  // Handle canvas ready callback
  const handleCanvasReady = useCallback((canvas: FabricCanvasType, vtContext: VirtualTilingContext) => {
    setFabricCanvas(canvas)
    setVirtualTilingContext(vtContext)
  }, [])

  // Initialize LayerManager and EntityGroupManager when canvas is ready
  useEffect(() => {
    if (!fabricCanvas || layerManager) return

    const manager = new LayerManager(fabricCanvas)
    setLayerManager(manager)
    setCurrentLayerId(manager.getDefaultLayerId())

    const groupManager = new EntityGroupManager(fabricCanvas, manager)
    setEntityGroupManager(groupManager)
  }, [fabricCanvas, layerManager])

  // Enable virtual tiling on TilingEngine and LayerManager when context is ready
  useEffect(() => {
    if (!tilingEngine || !virtualTilingContext?.selectionProxyManager) return

    const { canonicalStore, selectionProxyManager, hitTestInterceptor } = virtualTilingContext

    // Enable virtual tiling mode on TilingEngine
    tilingEngine.enableVirtualTiling(canonicalStore, selectionProxyManager)

    // Enable virtual tiling mode on LayerManager
    if (layerManager) {
      layerManager.setCanonicalStore(canonicalStore)
      hitTestInterceptor.setLayerManager(layerManager)
    }
  }, [tilingEngine, virtualTilingContext, layerManager])

  // Auto-save function with debounce
  const triggerAutoSave = useCallback(() => {
    if (!fabricCanvas || !layerManager) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout (2 seconds debounce)
    autoSaveTimeoutRef.current = setTimeout(() => {
      const projectData = serializeProject(fabricCanvas, layerManager, DRAWING_TILE_SIZE, entityGroupManager)
      const success = saveToLocalStorage(projectData)

      if (!success) {
        console.warn('Auto-save failed - project may be too large')
      }
    }, 2000)
  }, [fabricCanvas, layerManager, entityGroupManager])

  // Use placement controls hook
  const { updatePosition, updateRotation, updateScale, updateFlip } = usePlacementControls({
    canvas: fabricCanvas,
    selectedObject,
    snapToGrid,
    gridSize,
    enabled: tool === 'select',
  })

  // Setup drawing mode based on tool
  useEffect(() => {
    if (!fabricCanvas) return

    console.log('Setting up tool:', tool)

    if (tool === 'brush' || tool === 'eraser') {
      // Create a new PencilBrush and assign it
      const brush = new PencilBrush(fabricCanvas)
      brush.width = brushSize
      brush.color = tool === 'eraser' ? '#1a1a25' : color

      fabricCanvas.freeDrawingBrush = brush
      fabricCanvas.isDrawingMode = true
      fabricCanvas.selection = false

      console.log('Drawing mode enabled, brush configured:', brush)
      console.log('Brush - width:', brushSize, 'color:', brush.color)
    } else if (tool === 'select') {
      fabricCanvas.isDrawingMode = false
      fabricCanvas.selection = true
      console.log('Select mode enabled')
    } else {
      fabricCanvas.isDrawingMode = false
      fabricCanvas.selection = false
      console.log('Shape drawing mode enabled for:', tool)
    }
  }, [fabricCanvas, tool, brushSize, color])

  // Handle path creation (brush strokes)
  useEffect(() => {
    if (!fabricCanvas || !tilingEngine) return

    const handlePathCreated = async (e: any) => {
      console.log('Path created event fired:', e)
      const path = e.path
      if (!path) {
        console.log('No path in event')
        return
      }

      console.log('Path object:', path)

      // Get the path's bounding box for positioning
      const bounds = path.getBoundingRect()
      const position = { x: bounds.left, y: bounds.top }
      console.log('Position:', position)

      // Remove the original path from canvas (but keep it in memory)
      fabricCanvas.remove(path)

      // Clone the path to avoid issues with the original being modified
      const pathClone = await path.clone()
      console.log('Path cloned:', pathClone)

      // Create tiled version with the clone
      console.log('Creating tiled object with layerId:', currentLayerId)
      if (tilingEngine.isVirtualTilingEnabled()) {
        await tilingEngine.createCanonicalObject(pathClone, position, currentLayerId)
      } else {
        await tilingEngine.createTiledObject(pathClone, position, currentLayerId)
      }

      // Request render to show the tiled paths
      fabricCanvas.requestRenderAll()
      console.log('Render requested')
    }

    fabricCanvas.on('path:created', handlePathCreated)
    console.log('path:created listener attached')

    return () => {
      fabricCanvas.off('path:created', handlePathCreated)
    }
  }, [fabricCanvas, tilingEngine, currentLayerId])

  // Sync selection from editor to entity list and placement panel
  useEffect(() => {
    if (!fabricCanvas) return

    const handleSelectionCreated = (e: any) => {
      // Get selected objects - either from event or from ActiveSelection
      let selected = e.selected as ExtendedFabricObject[]
      const activeObject = fabricCanvas.getActiveObject()

      // If activeObject is an ActiveSelection, get all objects from it
      if (activeObject?.type === 'activeselection') {
        selected = (activeObject as any).getObjects() as ExtendedFabricObject[]
      }

      if (!selected || selected.length === 0) return

      const newSelectedIds = new Set<string>()
      let hasEntityGroup = false

      selected.forEach((obj: any) => {
        // Handle proxy objects in virtual tiling mode
        if (obj?.proxyMetadata?.isProxy) {
          const mirrorGroupId = obj.proxyMetadata.mirrorGroupId
          // Get the canonical object to check for entity groups
          const canonical = virtualTilingContext?.canonicalStore.get(mirrorGroupId)
          if (canonical?.tiledMetadata?.entityGroupId && entityGroupManager) {
            hasEntityGroup = true
            const group = entityGroupManager.getGroup(canonical.tiledMetadata.entityGroupId)
            if (group) {
              group.memberMirrorGroupIds.forEach((id) => newSelectedIds.add(id))
            }
          } else {
            newSelectedIds.add(mirrorGroupId)
          }
          // Set canonical object for placement panel
          if (canonical) {
            setSelectedObject(canonical)
          }
          return
        }

        // Handle regular tiled objects (legacy mode)
        if (obj?.tiledMetadata?.mirrorGroupId) {
          const mirrorGroupId = obj.tiledMetadata.mirrorGroupId

          // If object is in an entity group, select all group members
          const entityGroupId = obj.tiledMetadata.entityGroupId
          if (entityGroupId && entityGroupManager) {
            hasEntityGroup = true
            const group = entityGroupManager.getGroup(entityGroupId)
            if (group) {
              group.memberMirrorGroupIds.forEach((id) => newSelectedIds.add(id))
            }
          } else {
            newSelectedIds.add(mirrorGroupId)
          }
        }
      })

      setSelectedEntityIds(newSelectedIds)

      // If entity group involved, select all center-tile objects for proper bounding box
      if (hasEntityGroup && layerManager && newSelectedIds.size > 1) {
        const objectsToSelect: ExtendedFabricObject[] = []
        newSelectedIds.forEach((mirrorGroupId) => {
          const objects = layerManager.getObjectsByMirrorGroup(mirrorGroupId)
          // Find center tile object (position [0,0])
          const centerTile = objects.find(
            (obj) => obj.tiledMetadata?.tilePosition?.[0] === 0 && obj.tiledMetadata?.tilePosition?.[1] === 0
          )
          if (centerTile) {
            objectsToSelect.push(centerTile)
          }
        })

        if (objectsToSelect.length > 1) {
          // Create active selection with all group members
          const newSelection = new ActiveSelection(objectsToSelect, { canvas: fabricCanvas })
          fabricCanvas.setActiveObject(newSelection)
          fabricCanvas.requestRenderAll()
        }
      }

      // Set the first selected object for placement panel (only if not already set by proxy handling)
      if (selected[0] && !selectedObject) {
        setSelectedObject(selected[0] as ExtendedFabricObject)
      }
    }

    const handleSelectionUpdated = (e: any) => {
      // Get selected objects - either from event or from ActiveSelection
      let selected = e.selected as ExtendedFabricObject[]
      const activeObject = fabricCanvas.getActiveObject()

      // If activeObject is an ActiveSelection, get all objects from it
      if (activeObject?.type === 'activeselection') {
        selected = (activeObject as any).getObjects() as ExtendedFabricObject[]
      }

      if (!selected || selected.length === 0) return

      const newSelectedIds = new Set<string>()

      selected.forEach((obj: any) => {
        // Handle proxy objects in virtual tiling mode
        if (obj?.proxyMetadata?.isProxy) {
          const mirrorGroupId = obj.proxyMetadata.mirrorGroupId
          const canonical = virtualTilingContext?.canonicalStore.get(mirrorGroupId)
          if (canonical?.tiledMetadata?.entityGroupId && entityGroupManager) {
            const group = entityGroupManager.getGroup(canonical.tiledMetadata.entityGroupId)
            if (group) {
              group.memberMirrorGroupIds.forEach((id) => newSelectedIds.add(id))
            }
          } else {
            newSelectedIds.add(mirrorGroupId)
          }
          if (canonical) {
            setSelectedObject(canonical)
          }
          return
        }

        // Handle regular tiled objects (legacy mode)
        if (obj?.tiledMetadata?.mirrorGroupId) {
          const mirrorGroupId = obj.tiledMetadata.mirrorGroupId

          // If object is in an entity group, select all group members
          const entityGroupId = obj.tiledMetadata.entityGroupId
          if (entityGroupId && entityGroupManager) {
            const group = entityGroupManager.getGroup(entityGroupId)
            if (group) {
              group.memberMirrorGroupIds.forEach((id) => newSelectedIds.add(id))
            }
          } else {
            newSelectedIds.add(mirrorGroupId)
          }
        }
      })

      setSelectedEntityIds(newSelectedIds)
      // Set the first selected object for placement panel
      if (selected[0] && !(selected[0] as any)?.proxyMetadata?.isProxy) {
        setSelectedObject(selected[0] as ExtendedFabricObject)
      }
    }

    const handleSelectionCleared = () => {
      setSelectedEntityIds(new Set())
      setSelectedObject(null)

      // Clear proxies in virtual tiling mode
      if (virtualTilingContext?.selectionProxyManager) {
        virtualTilingContext.selectionProxyManager.clearAll()
        fabricCanvas.requestRenderAll()
      }
    }

    fabricCanvas.on('selection:created', handleSelectionCreated)
    fabricCanvas.on('selection:updated', handleSelectionUpdated)
    fabricCanvas.on('selection:cleared', handleSelectionCleared)

    return () => {
      fabricCanvas.off('selection:created', handleSelectionCreated)
      fabricCanvas.off('selection:updated', handleSelectionUpdated)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
    }
  }, [fabricCanvas, entityGroupManager, virtualTilingContext, layerManager, selectedObject])

  // Track object modifications to update placement panel
  useEffect(() => {
    if (!fabricCanvas) return

    const handleObjectModified = () => {
      setObjectUpdateCounter(prev => prev + 1)
    }

    fabricCanvas.on('object:modified', handleObjectModified)
    fabricCanvas.on('object:moving', handleObjectModified)
    fabricCanvas.on('object:scaling', handleObjectModified)
    fabricCanvas.on('object:rotating', handleObjectModified)

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified)
      fabricCanvas.off('object:moving', handleObjectModified)
      fabricCanvas.off('object:scaling', handleObjectModified)
      fabricCanvas.off('object:rotating', handleObjectModified)
    }
  }, [fabricCanvas])

  // Virtual tiling hit testing - intercept clicks on canvas to select canonical objects via proxies
  useEffect(() => {
    if (!fabricCanvas || !virtualTilingContext?.hitTestInterceptor || !virtualTilingContext?.selectionProxyManager) return
    if (tool !== 'select') return

    const { hitTestInterceptor, selectionProxyManager } = virtualTilingContext

    const handleMouseDown = (e: any) => {
      // Skip if Fabric.js already found a target (like an existing proxy)
      if (e.target) return

      // Get click point
      const pointer = fabricCanvas.getViewportPoint(e.e)

      // Perform hit test against canonical objects at all tile positions
      const hitResult = hitTestInterceptor.findCanonicalObjectAtPoint(pointer)

      if (hitResult) {
        const { canonicalObject, tileOffset } = hitResult

        // Clear existing proxies
        selectionProxyManager.clearAll()

        // Create proxy at the clicked tile offset
        const proxy = selectionProxyManager.createProxy(canonicalObject, tileOffset)

        // Select the proxy
        fabricCanvas.setActiveObject(proxy)
        fabricCanvas.requestRenderAll()

        // Prevent Fabric from continuing with its default handling
        e.e.preventDefault?.()
        e.e.stopPropagation?.()
      }
    }

    fabricCanvas.on('mouse:down', handleMouseDown)

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown)
    }
  }, [fabricCanvas, virtualTilingContext, tool])

  // Handle shape drawing (rectangle, circle)
  useEffect(() => {
    if (!fabricCanvas || !tilingEngine) return
    if (tool !== 'rectangle' && tool !== 'circle') return

    const handleMouseDown = (e: any) => {
      // Don't create shapes if clicking on an existing object
      if (e.target && e.target !== fabricCanvas) return

      const pointer = fabricCanvas.getViewportPoint(e.e)
      setIsDrawingShape(true)
      setShapeStart(pointer)

      // Create temp shape for preview
      let shape: any
      if (tool === 'rectangle') {
        shape = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: color,
          stroke: color,
          strokeWidth: 2,
        })
      } else {
        shape = new Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: color,
          stroke: color,
          strokeWidth: 2,
        })
      }

      fabricCanvas.add(shape)
      setTempShape(shape)
    }

    const handleMouseMove = (e: any) => {
      if (!isDrawingShape || !shapeStart || !tempShape) return

      const pointer = fabricCanvas.getViewportPoint(e.e)

      if (tool === 'rectangle') {
        const width = pointer.x - shapeStart.x
        const height = pointer.y - shapeStart.y

        tempShape.set({
          width: Math.abs(width),
          height: Math.abs(height),
          left: width < 0 ? pointer.x : shapeStart.x,
          top: height < 0 ? pointer.y : shapeStart.y,
        })
      } else {
        const radius = Math.sqrt(
          Math.pow(pointer.x - shapeStart.x, 2) + Math.pow(pointer.y - shapeStart.y, 2)
        )
        tempShape.set({ radius })
      }

      fabricCanvas.requestRenderAll()
    }

    const handleMouseUp = async () => {
      if (!isDrawingShape || !tempShape) return

      // Remove temp shape
      fabricCanvas.remove(tempShape)

      // Create final tiled shape
      if (tool === 'rectangle' && tempShape.width > 5 && tempShape.height > 5) {
        const rect = new Rect({
          left: tempShape.left,
          top: tempShape.top,
          width: tempShape.width,
          height: tempShape.height,
          fill: color,
          stroke: color,
          strokeWidth: 2,
        })
        if (tilingEngine.isVirtualTilingEnabled()) {
          await tilingEngine.createCanonicalObject(rect, { x: tempShape.left, y: tempShape.top }, currentLayerId)
        } else {
          await tilingEngine.createTiledObject(rect, { x: tempShape.left, y: tempShape.top }, currentLayerId)
        }
      } else if (tool === 'circle' && tempShape.radius > 5) {
        const circle = new Circle({
          left: tempShape.left,
          top: tempShape.top,
          radius: tempShape.radius,
          fill: color,
          stroke: color,
          strokeWidth: 2,
        })
        if (tilingEngine.isVirtualTilingEnabled()) {
          await tilingEngine.createCanonicalObject(circle, { x: tempShape.left, y: tempShape.top }, currentLayerId)
        } else {
          await tilingEngine.createTiledObject(circle, { x: tempShape.left, y: tempShape.top }, currentLayerId)
        }
      }

      setIsDrawingShape(false)
      setShapeStart(null)
      setTempShape(null)
    }

    fabricCanvas.on('mouse:down', handleMouseDown)
    fabricCanvas.on('mouse:move', handleMouseMove)
    fabricCanvas.on('mouse:up', handleMouseUp)

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown)
      fabricCanvas.off('mouse:move', handleMouseMove)
      fabricCanvas.off('mouse:up', handleMouseUp)
    }
  }, [fabricCanvas, tilingEngine, tool, color, isDrawingShape, shapeStart, tempShape, currentLayerId])

  // Update tile preview from Fabric canvas
  // Called via onAfterRender callback AFTER virtual copies are drawn
  const updateTilePreview = useCallback(() => {
    if (!fabricCanvas) return

    const tileCanvas = tileCanvasRef.current
    if (!tileCanvas) return

    const tileCtx = tileCanvas.getContext('2d')
    if (!tileCtx) return

    // Get the underlying HTML canvas element
    // At this point, after:render has completed and virtual copies are drawn
    const sourceCanvas = fabricCanvas.getElement()

    // Account for devicePixelRatio - Fabric.js scales the canvas buffer
    // for retina displays, so we need to scale our extraction coordinates
    const retinaScaling = fabricCanvas.getRetinaScaling()
    const scaledTileSize = DRAWING_TILE_SIZE * retinaScaling

    // Extract center tile from the canvas
    // Center tile is at (tileSize, tileSize) to (2*tileSize, 2*tileSize) in logical coords
    // But the canvas buffer is scaled by retinaScaling
    tileCtx.clearRect(0, 0, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE)
    tileCtx.drawImage(
      sourceCanvas,
      scaledTileSize, scaledTileSize,        // Source x, y (scaled for retina)
      scaledTileSize, scaledTileSize,        // Source width, height (scaled for retina)
      0, 0,                                   // Dest x, y
      DRAWING_TILE_SIZE, DRAWING_TILE_SIZE   // Dest width, height
    )
  }, [fabricCanvas])

  // Check for auto-save on mount
  useEffect(() => {
    if (!fabricCanvas || !layerManager) return

    if (hasAutosave()) {
      setShowRecoveryDialog(true)
    }
  }, [fabricCanvas, layerManager])

  // Set up auto-save and dirty state tracking
  useEffect(() => {
    if (!fabricCanvas) return

    const handleChange = () => {
      setIsDirty(true)
      triggerAutoSave()
    }

    fabricCanvas.on('object:modified', handleChange)
    fabricCanvas.on('object:added', handleChange)
    fabricCanvas.on('object:removed', handleChange)
    fabricCanvas.on('path:created', handleChange)

    return () => {
      fabricCanvas.off('object:modified', handleChange)
      fabricCanvas.off('object:added', handleChange)
      fabricCanvas.off('object:removed', handleChange)
      fabricCanvas.off('path:created', handleChange)
    }
  }, [fabricCanvas, triggerAutoSave])

  // Page unload warning
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Update selectedObject state during drag/scale/rotate to trigger PlacementPanel re-render
  useEffect(() => {
    if (!fabricCanvas || !selectedObject) return

    const handleObjectTransform = (e: { target: ExtendedFabricObject }) => {
      // Only update if the transformed object is the selected one
      if (e.target === selectedObject) {
        // Increment counter to force PlacementPanel re-render
        // This triggers the useEffect in PlacementPanel that depends on object properties
        setObjectUpdateCounter((prev) => prev + 1)
      }
    }

    fabricCanvas.on('object:moving', handleObjectTransform)
    fabricCanvas.on('object:scaling', handleObjectTransform)
    fabricCanvas.on('object:rotating', handleObjectTransform)

    return () => {
      fabricCanvas.off('object:moving', handleObjectTransform)
      fabricCanvas.off('object:scaling', handleObjectTransform)
      fabricCanvas.off('object:rotating', handleObjectTransform)
    }
  }, [fabricCanvas, selectedObject])

  const clearCanvas = () => {
    if (!fabricCanvas) return

    // Clear canonical store in virtual tiling mode
    if (virtualTilingContext?.canonicalStore) {
      virtualTilingContext.canonicalStore.clear()
    }

    // Clear selection proxies
    if (virtualTilingContext?.selectionProxyManager) {
      virtualTilingContext.selectionProxyManager.clearAll()
    }

    // Clear entity groups
    if (entityGroupManager) {
      entityGroupManager.clear()
    }

    // Remove all objects except grid lines
    const objects = fabricCanvas.getObjects().filter((obj: any) => !obj.gridLine)
    objects.forEach((obj) => fabricCanvas.remove(obj))
    fabricCanvas.requestRenderAll()

    // Clear tile preview
    const tileCanvas = tileCanvasRef.current
    if (tileCanvas) {
      const ctx = tileCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1a25'
        ctx.fillRect(0, 0, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE)
      }
    }

    // Clear selection state
    setSelectedEntityIds(new Set())
    setSelectedObject(null)
  }

  const handleExportClick = () => {
    setIsExportDialogOpen(true)
  }

  const updateObjectProperties = (properties: Record<string, unknown>) => {
    if (!selectedObject || !layerManager) return

    // Update the selected object
    selectedObject.set(properties)
    selectedObject.setCoords()

    // Get the mirror group ID and update all tiled copies
    const mirrorGroupId = selectedObject.tiledMetadata?.mirrorGroupId
    if (mirrorGroupId) {
      const objects = layerManager.getObjectsByMirrorGroup(mirrorGroupId)
      objects.forEach(obj => {
        if (obj !== selectedObject) {
          obj.set(properties)
          obj.setCoords()
        }
      })
    }

    fabricCanvas?.requestRenderAll()
  }

  const handleSVGCodeImport = async (svgCode: string) => {
    if (!fabricCanvas || !tilingEngine) return

    try {
      // Create a data URL from the SVG code
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgCode)

      loadSVGFromURL(dataUrl).then(async (result: any) => {
        await importSVGObjects(result.objects, result.options)
      }).catch((err) => console.error('SVG load error:', err))
    } catch (err) {
      console.error('Failed to import SVG code:', err)
    }
  }

  // Helper to import SVG objects - creates separate entities for multi-element SVGs
  const importSVGObjects = async (objects: any[], options: any) => {
    if (!fabricCanvas || !tilingEngine) return

    const basePosition = { x: DRAWING_TILE_SIZE * 1.5, y: DRAWING_TILE_SIZE * 1.5 }
    const maxSize = DRAWING_TILE_SIZE * 0.8

    // If only one object or no objects, use existing single-group behavior
    if (objects.length <= 1) {
      const svgGroup = fabricUtil.groupSVGElements(objects, options)
      if (svgGroup.width! > maxSize || svgGroup.height! > maxSize) {
        const scale = maxSize / Math.max(svgGroup.width!, svgGroup.height!)
        svgGroup.scale(scale)
      }
      if (tilingEngine.isVirtualTilingEnabled()) {
        await tilingEngine.createCanonicalObject(svgGroup, basePosition, currentLayerId)
      } else {
        await tilingEngine.createTiledObject(svgGroup, basePosition, currentLayerId)
      }
      fabricCanvas.requestRenderAll()
      return
    }

    // Multiple elements: create each as separate tiled entity
    // Calculate bounding box of all objects to determine scale
    const svgGroup = fabricUtil.groupSVGElements(objects, options)
    const groupWidth = svgGroup.width || 1
    const groupHeight = svgGroup.height || 1
    const scale = Math.min(1, maxSize / Math.max(groupWidth, groupHeight))

    // Get offset from options (viewBox origin)
    const offsetX = options.left || 0
    const offsetY = options.top || 0

    const createdMirrorGroupIds: string[] = []

    // Phase 1: Clone all objects in parallel
    const clonePromises = objects.map(obj => obj.clone())
    const clonedObjects = await Promise.all(clonePromises)

    // Phase 2: Create tiled objects sequentially for z-order
    for (let i = 0; i < clonedObjects.length; i++) {
      const cloned = clonedObjects[i]
      const original = objects[i]

      // Scale the object
      cloned.scale((cloned.scaleX || 1) * scale)

      // Position relative to center tile, accounting for SVG viewBox offset
      // Use original's position since clone may have different left/top after clone
      const objLeft = (original.left || 0) - offsetX
      const objTop = (original.top || 0) - offsetY
      const position = {
        x: basePosition.x + objLeft * scale,
        y: basePosition.y + objTop * scale
      }

      // Create tiled object and capture its mirrorGroupId
      if (tilingEngine.isVirtualTilingEnabled()) {
        const mirrorGroupId = await tilingEngine.createCanonicalObject(cloned, position, currentLayerId)
        createdMirrorGroupIds.push(mirrorGroupId)
      } else {
        const tiledObjects = await tilingEngine.createTiledObject(cloned, position, currentLayerId)
        if (tiledObjects.length > 0 && tiledObjects[0].tiledMetadata?.mirrorGroupId) {
          createdMirrorGroupIds.push(tiledObjects[0].tiledMetadata.mirrorGroupId)
        }
      }
    }

    // Auto-group if multiple entities were created
    if (createdMirrorGroupIds.length > 1 && entityGroupManager) {
      const group = entityGroupManager.createGroup(createdMirrorGroupIds, 'SVG Import')
      if (group) {
        // Select the new group to update UI
        setSelectedEntityIds(new Set(group.memberMirrorGroupIds))
      }
    }

    fabricCanvas.requestRenderAll()
  }

  const handleSVGImport = async (file: File) => {
    if (!fabricCanvas || !tilingEngine) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string

      if (file.type.includes('svg')) {
        // Handle SVG - use helper that creates separate entities for multi-element SVGs
        loadSVGFromURL(dataUrl).then(async (result: any) => {
          await importSVGObjects(result.objects, result.options)
        }).catch((err) => console.error('SVG load error:', err))
      } else {
        // Handle images (PNG, JPEG)
        FabricImage.fromURL(dataUrl).then(async (img) => {
          // Scale down if too large
          const maxSize = DRAWING_TILE_SIZE * 0.8
          if (img.width! > maxSize || img.height! > maxSize) {
            const scale = maxSize / Math.max(img.width!, img.height!)
            img.scale(scale)
          }

          // Position at center of center tile
          const position = { x: DRAWING_TILE_SIZE * 1.5, y: DRAWING_TILE_SIZE * 1.5 }
          if (tilingEngine.isVirtualTilingEnabled()) {
            await tilingEngine.createCanonicalObject(img, position, currentLayerId)
          } else {
            await tilingEngine.createTiledObject(img, position, currentLayerId)
          }
          fabricCanvas.requestRenderAll()
        })
      }
    }

    reader.readAsDataURL(file)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleSVGImport(file)
    e.target.value = '' // Reset input
  }

  const handleDuplicateEntity = async (mirrorGroupId: string) => {
    if (!layerManager || !tilingEngine || !fabricCanvas) return

    const objects = layerManager.getObjectsByMirrorGroup(mirrorGroupId)
    if (objects.length === 0) return

    // Get the first object to clone
    const firstObj = objects[0] as ExtendedFabricObject

    // Clone the first object
    const cloned = await firstObj.clone()

    // Offset the position slightly so it's visible
    const offset = 20
    const position = {
      x: (firstObj.left || 0) + offset,
      y: (firstObj.top || 0) + offset
    }

    // Create tiled version with the same layer
    if (tilingEngine.isVirtualTilingEnabled()) {
      await tilingEngine.createCanonicalObject(cloned, position, firstObj.layerId)
    } else {
      await tilingEngine.createTiledObject(cloned, position, firstObj.layerId)
    }
    fabricCanvas.requestRenderAll()
  }

  const handleEditSVG = (mirrorGroupId: string, svgCode: string) => {
    setEditingSVGId(mirrorGroupId)
    setEditingSVGCode(svgCode)
  }

  // Group selected entities
  const handleGroupSelected = useCallback(() => {
    if (!entityGroupManager || selectedEntityIds.size < 2) return

    const mirrorGroupIds = Array.from(selectedEntityIds)
    const group = entityGroupManager.createGroup(mirrorGroupIds)

    if (group) {
      // Update selection to reflect the group - this triggers EntityPanel refresh
      setSelectedEntityIds(new Set(group.memberMirrorGroupIds))
    }
  }, [entityGroupManager, selectedEntityIds])

  // Ungroup selected entity group
  const handleUngroupSelected = useCallback(() => {
    if (!entityGroupManager || selectedEntityIds.size === 0) return

    // Find the first selected entity that is in a group
    for (const mirrorGroupId of selectedEntityIds) {
      const group = entityGroupManager.getGroupByMirrorGroupId(mirrorGroupId)
      if (group) {
        const memberIds = entityGroupManager.ungroup(group.id)
        // Keep the same entities selected after ungrouping
        setSelectedEntityIds(new Set(memberIds))
        return
      }
    }
  }, [entityGroupManager, selectedEntityIds])

  // Keyboard shortcuts for grouping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl/Cmd + G = Group
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        handleGroupSelected()
      }

      // Ctrl/Cmd + Shift + G = Ungroup
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'g') {
        e.preventDefault()
        handleUngroupSelected()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGroupSelected, handleUngroupSelected])

  const handleSelectEntity = (mirrorGroupId: string) => {
    if (!fabricCanvas || !layerManager) return

    // Switch to select tool
    setTool('select')

    // Get the canonical object for this group
    const objects = layerManager.getObjectsByMirrorGroup(mirrorGroupId)
    if (objects.length === 0) return

    const canonical = objects[0]

    // In virtual tiling mode, create a proxy at center tile and select it
    if (virtualTilingContext?.selectionProxyManager) {
      const { selectionProxyManager } = virtualTilingContext

      // Clear any existing proxies first
      selectionProxyManager.clearAll()

      // Create proxy at center tile [0,0]
      const proxy = selectionProxyManager.createProxy(canonical, [0, 0])

      // Select the proxy
      fabricCanvas.discardActiveObject()
      fabricCanvas.setActiveObject(proxy)
      fabricCanvas.requestRenderAll()
    } else {
      // Legacy mode - select the object directly (for non-virtual tiling)
      // Find the object closest to the center of the canvas
      const canvasCenter = { x: fabricCanvas.width! / 2, y: fabricCanvas.height! / 2 }
      let closestObject = objects[0]
      let minDistance = Number.MAX_VALUE

      objects.forEach((obj) => {
        const objCenterX = (obj.left || 0) + ((obj.width || 0) * (obj.scaleX || 1)) / 2
        const objCenterY = (obj.top || 0) + ((obj.height || 0) * (obj.scaleY || 1)) / 2
        const distance = Math.sqrt(
          Math.pow(objCenterX - canvasCenter.x, 2) +
          Math.pow(objCenterY - canvasCenter.y, 2)
        )

        if (distance < minDistance) {
          minDistance = distance
          closestObject = obj
        }
      })

      // Select the object closest to center
      fabricCanvas.discardActiveObject()
      fabricCanvas.setActiveObject(closestObject)
      fabricCanvas.requestRenderAll()
    }
  }

  const handleSaveSVG = async (newSVGCode: string) => {
    if (!editingSVGId || !layerManager || !tilingEngine || !fabricCanvas) return

    // Get the old objects
    const oldObjects = layerManager.getObjectsByMirrorGroup(editingSVGId)
    if (oldObjects.length === 0) return

    const layerId = oldObjects[0].layerId
    const position = {
      x: oldObjects[0].left || 0,
      y: oldObjects[0].top || 0
    }

    // Delete the old entity
    layerManager.deleteMirrorGroup(editingSVGId)

    // Import the new SVG code
    try {
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(newSVGCode)

      loadSVGFromURL(dataUrl).then(async (result: any) => {
        const svgGroup = fabricUtil.groupSVGElements(result.objects, result.options)

        // Position at the same location as the old one
        if (tilingEngine.isVirtualTilingEnabled()) {
          await tilingEngine.createCanonicalObject(svgGroup, position, layerId)
        } else {
          await tilingEngine.createTiledObject(svgGroup, position, layerId)
        }
        fabricCanvas.requestRenderAll()
      }).catch((err) => console.error('SVG load error:', err))
    } catch (err) {
      console.error('Failed to update SVG:', err)
    }

    setEditingSVGId(null)
    setEditingSVGCode('')
  }

  // Project import/export handlers
  const handleExportProject = (filename: string) => {
    if (!fabricCanvas || !layerManager) return

    try {
      exportProjectAsJSON(fabricCanvas, layerManager, DRAWING_TILE_SIZE, filename, entityGroupManager)
      setIsProjectExportDialogOpen(false)
      // Clear dirty state and autosave after successful export
      setIsDirty(false)
      clearAutosave()
    } catch (error) {
      console.error('Failed to export project:', error)
      alert('Failed to export project. Please try again.')
    }
  }

  const handleImportProjectClick = () => {
    projectFileInputRef.current?.click()
  }

  const handleProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !fabricCanvas || !layerManager || !tilingEngine) return

    setIsImporting(true)

    try {
      await importProjectFromFile(file, fabricCanvas, layerManager, tilingEngine, entityGroupManager)

      // Update current layer to first imported layer
      const layers = layerManager.getLayers()
      if (layers.length > 0) {
        setCurrentLayerId(layers[0].id)
      }

      // Clear dirty state after successful import
      setIsDirty(false)

      alert('Project imported successfully!')
    } catch (error) {
      console.error('Failed to import project:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to import project: ${message}`)
    } finally {
      setIsImporting(false)
      // Reset file input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  // Recovery dialog handlers
  const handleRecover = async () => {
    if (!fabricCanvas || !layerManager || !tilingEngine) return

    const projectData = loadFromLocalStorage()
    if (!projectData) {
      alert('Failed to load saved session')
      setShowRecoveryDialog(false)
      return
    }

    try {
      await deserializeProject(projectData, fabricCanvas, layerManager, tilingEngine, entityGroupManager)

      // Update current layer to first imported layer
      const layers = layerManager.getLayers()
      if (layers.length > 0) {
        setCurrentLayerId(layers[0].id)
      }

      setShowRecoveryDialog(false)
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to recover session:', error)
      alert('Failed to recover session')
      setShowRecoveryDialog(false)
    }
  }

  const handleDiscardRecovery = () => {
    clearAutosave()
    setShowRecoveryDialog(false)
  }

  const presetColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#f8f9fa', '#2c3e50']

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-dark text-text-primary overflow-hidden">
      <header className="flex items-center px-6 py-4 bg-bg-panel/80 backdrop-blur-sm border-b border-primary/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-primary">◫</span>
          <span className="text-xl font-semibold text-white">Endless Tiles</span>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-bg-panel border-r border-primary/10 flex flex-col gap-4 p-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Tools</span>
            <div className="grid grid-cols-3 gap-2">
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'select'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setTool('select')}
                aria-label="Select tool"
              >
                <MousePointer2 size={20} />
              </Button>
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'brush'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setTool('brush')}
                aria-label="Brush tool"
              >
                <Brush size={20} />
              </Button>
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'eraser'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setTool('eraser')}
                aria-label="Eraser tool"
              >
                <Eraser size={20} />
              </Button>
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'rectangle'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setTool('rectangle')}
                aria-label="Rectangle tool"
              >
                <Square size={20} />
              </Button>
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'circle'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setTool('circle')}
                aria-label="Circle tool"
              >
                <CircleIcon size={20} />
              </Button>
              <Button
                className={`p-3 rounded-lg transition-all ${
                  tool === 'svg'
                    ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                onPress={() => setIsImportDialogOpen(true)}
                aria-label="Import SVG or image"
              >
                <FileUp size={20} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Brush Size</span>
              <span className="text-xs text-text-primary">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="64"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Color</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                    setColor(value)
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value
                  if (!value.match(/^#[0-9A-Fa-f]{6}$/)) {
                    setColor(color)
                  }
                }}
                placeholder="#ff6b6b"
                maxLength={7}
                className="flex-1 px-2 py-2 bg-white/5 border border-primary/20 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    color === c ? 'ring-2 ring-primary scale-110 shadow-[0_0_10px_rgba(45,212,168,0.3)]' : 'hover:scale-110'
                  }`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className={`px-3 py-2 rounded-lg text-sm transition-all ${
                showZoomView
                  ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(45,212,168,0.2)]'
                  : 'bg-white/5 text-text-primary hover:bg-white/10 hover:text-white'
              }`}
              onPress={() => setShowZoomView(!showZoomView)}
              aria-label={showZoomView ? 'Hide zoom view' : 'Show zoom view'}
            >
              {showZoomView ? 'Hide Zoom' : 'Show Zoom'}
            </Button>
            <Button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
              onPress={handleImportClick}
              aria-label="Import file"
            >
              Import File
            </Button>
            <Button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
              onPress={() => setIsSVGCodeDialogOpen(true)}
              aria-label="Open SVG code editor"
            >
              SVG Code
            </Button>
            <Button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
              onPress={clearCanvas}
              aria-label="Clear canvas"
            >
              Clear
            </Button>
            <Button
              className="px-3 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
              onPress={handleExportClick}
              aria-label="Export tile"
            >
              Export
            </Button>
            <Button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onPress={handleImportProjectClick}
              isDisabled={isImporting}
              aria-label="Import project"
            >
              {isImporting ? 'Importing...' : 'Import Project'}
            </Button>
            <Button
              className="px-3 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
              onPress={() => setIsProjectExportDialogOpen(true)}
              aria-label="Export project"
            >
              Export Project
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              ref={projectFileInputRef}
              type="file"
              accept=".tiles"
              className="hidden"
              onChange={handleProjectFileUpload}
            />
          </div>
        </aside>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
          <div className="flex items-start justify-center gap-6 flex-wrap">
            {/* 3x3 Grid Canvas Section */}
            <div className="flex flex-col gap-3 bg-bg-panel rounded-xl border border-primary/10 p-4 shadow-xl shrink-0 panel-glow">
              <span className="text-sm font-semibold text-text-primary">Draw on 3x3 Grid</span>

              <div className="relative">
                {/* Grid overlay for Fabric canvas */}
                <GridOverlay fabricCanvas={fabricCanvas} tileSize={DRAWING_TILE_SIZE} />

                {/* Fabric.js canvas - maintains aspect ratio */}
                <FabricCanvas
                  className="block"
                  visible={true}
                  tileSize={DRAWING_TILE_SIZE}
                  onCanvasReady={handleCanvasReady}
                  onAfterRender={updateTilePreview}
                />
              </div>
            </div>

            {/* Zoom View or Tile Result Section */}
            {showZoomView ? (
              <ZoomView
                fabricCanvas={fabricCanvas}
                zoomLevel={zoomLevel}
                followMode={followMode}
                selectedObject={selectedObject}
                enabled={showZoomView}
                onZoomLevelChange={setZoomLevel}
                onFollowModeChange={setFollowMode}
              />
            ) : (
              <div className="flex flex-col gap-3 bg-bg-panel rounded-xl border border-primary/10 p-4 shadow-xl shrink-0 panel-glow">
                <span className="text-sm font-semibold text-text-primary">Tile Result</span>
                <div className="relative">
                  <canvas
                    ref={tileCanvasRef}
                    width={DRAWING_TILE_SIZE}
                    height={DRAWING_TILE_SIZE}
                    className="block rounded-lg border-2 border-primary/30 shadow-lg shadow-primary/10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-96 bg-bg-panel border-l border-primary/10 flex flex-col gap-3 p-4 overflow-y-auto">
          <LayerPanel
            layerManager={layerManager}
            currentLayerId={currentLayerId}
            onLayerChange={setCurrentLayerId}
          />
          <CollapsiblePanel title="Objects" defaultCollapsed={false}>
            <EntityPanel
              fabricCanvas={fabricCanvas}
              layerManager={layerManager}
              entityGroupManager={entityGroupManager}
              currentLayerId={currentLayerId}
              selectedEntityIds={selectedEntityIds}
              onSelectEntity={handleSelectEntity}
              onSelectionChange={setSelectedEntityIds}
              onDuplicateEntity={handleDuplicateEntity}
              onEditSVG={handleEditSVG}
              onGroupSelected={handleGroupSelected}
              onUngroupSelected={handleUngroupSelected}
            />
          </CollapsiblePanel>
          <CollapsiblePanel title="Advanced Placement" defaultCollapsed={false}>
            <PlacementPanel
              selectedObject={selectedObject}
              onUpdatePosition={updatePosition}
              onUpdateRotation={updateRotation}
              onUpdateScale={updateScale}
              onUpdateFlip={updateFlip}
              snapToGrid={snapToGrid}
              onToggleSnapToGrid={setSnapToGrid}
              gridSize={gridSize}
              onChangeGridSize={setGridSize}
              updateCounter={objectUpdateCounter}
            />
          </CollapsiblePanel>
          <CollapsiblePanel title="Properties" defaultCollapsed={false}>
            <PropertiesPanel
              selectedObject={selectedObject}
              onUpdateProperties={updateObjectProperties}
            />
          </CollapsiblePanel>
        </aside>
      </main>

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleSVGImport}
      />

      <SVGCodeDialog
        isOpen={isSVGCodeDialogOpen}
        onClose={() => setIsSVGCodeDialogOpen(false)}
        onImport={handleSVGCodeImport}
      />

      <SVGEditDialog
        isOpen={editingSVGId !== null}
        initialCode={editingSVGCode}
        onClose={() => {
          setEditingSVGId(null)
          setEditingSVGCode('')
        }}
        onSave={handleSaveSVG}
      />

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        fabricCanvas={fabricCanvas}
        tileSize={DRAWING_TILE_SIZE}
      />

      <ProjectExportDialog
        isOpen={isProjectExportDialogOpen}
        onClose={() => setIsProjectExportDialogOpen(false)}
        onExport={handleExportProject}
      />

      <RecoveryDialog
        isOpen={showRecoveryDialog}
        onRecover={handleRecover}
        onDiscard={handleDiscardRecovery}
      />
    </div>
  )
}

export default App
