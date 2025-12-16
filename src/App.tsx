import { useState, useRef, useEffect, useCallback } from 'react'
import type { Canvas as FabricCanvasType } from 'fabric'
import { Circle, Rect, FabricImage, loadSVGFromURL, util as fabricUtil, PencilBrush } from 'fabric'
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
import type { ExtendedFabricObject } from './types/FabricExtensions'
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
  const tilingEngine = useTilingEngine(fabricCanvas, DRAWING_TILE_SIZE)
  const [isDrawingShape, setIsDrawingShape] = useState(false)
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
  const [tempShape, setTempShape] = useState<any>(null)
  const [layerManager, setLayerManager] = useState<LayerManager | null>(null)
  const [currentLayerId, setCurrentLayerId] = useState<string>('')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isSVGCodeDialogOpen, setIsSVGCodeDialogOpen] = useState(false)
  const [editingSVGId, setEditingSVGId] = useState<string | null>(null)
  const [editingSVGCode, setEditingSVGCode] = useState<string>('')
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
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

  // Initialize LayerManager when canvas is ready
  useEffect(() => {
    if (!fabricCanvas || layerManager) return

    const manager = new LayerManager(fabricCanvas)
    setLayerManager(manager)
    setCurrentLayerId(manager.getDefaultLayerId())
  }, [fabricCanvas, layerManager])

  // Auto-save function with debounce
  const triggerAutoSave = useCallback(() => {
    if (!fabricCanvas || !layerManager) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout (2 seconds debounce)
    autoSaveTimeoutRef.current = setTimeout(() => {
      const projectData = serializeProject(fabricCanvas, layerManager, DRAWING_TILE_SIZE)
      const success = saveToLocalStorage(projectData)

      if (!success) {
        console.warn('Auto-save failed - project may be too large')
      }
    }, 2000)
  }, [fabricCanvas, layerManager])

  // Use placement controls hook
  const { updatePosition, updateRotation, updateScale } = usePlacementControls({
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
      await tilingEngine.createTiledObject(pathClone, position, currentLayerId)

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
      const selected = e.selected?.[0] as ExtendedFabricObject
      if (selected?.tiledMetadata?.mirrorGroupId) {
        setSelectedEntityId(selected.tiledMetadata.mirrorGroupId)
        setSelectedObject(selected)
      }
    }

    const handleSelectionUpdated = (e: any) => {
      const selected = e.selected?.[0] as ExtendedFabricObject
      if (selected?.tiledMetadata?.mirrorGroupId) {
        setSelectedEntityId(selected.tiledMetadata.mirrorGroupId)
        setSelectedObject(selected)
      }
    }

    const handleSelectionCleared = () => {
      setSelectedEntityId(null)
      setSelectedObject(null)
    }

    fabricCanvas.on('selection:created', handleSelectionCreated)
    fabricCanvas.on('selection:updated', handleSelectionUpdated)
    fabricCanvas.on('selection:cleared', handleSelectionCleared)

    return () => {
      fabricCanvas.off('selection:created', handleSelectionCreated)
      fabricCanvas.off('selection:updated', handleSelectionUpdated)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
    }
  }, [fabricCanvas])

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
        await tilingEngine.createTiledObject(rect, { x: tempShape.left, y: tempShape.top }, currentLayerId)
      } else if (tool === 'circle' && tempShape.radius > 5) {
        const circle = new Circle({
          left: tempShape.left,
          top: tempShape.top,
          radius: tempShape.radius,
          fill: color,
          stroke: color,
          strokeWidth: 2,
        })
        await tilingEngine.createTiledObject(circle, { x: tempShape.left, y: tempShape.top }, currentLayerId)
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
  const updateTileFromFabric = useCallback(() => {
    if (!fabricCanvas) return

    const tileCanvas = tileCanvasRef.current
    if (!tileCanvas) return

    const tileCtx = tileCanvas.getContext('2d')
    if (!tileCtx) return

    // Export Fabric canvas to image
    const dataURL = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 })
    const img = new Image()
    img.onload = () => {
      // Extract center tile
      tileCtx.clearRect(0, 0, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE)
      tileCtx.drawImage(
        img,
        DRAWING_TILE_SIZE, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE, // Source: center tile from 768px canvas
        0, 0, DRAWING_TILE_SIZE, DRAWING_TILE_SIZE // Destination: same size for preview
      )
    }
    img.src = dataURL
  }, [fabricCanvas])

  // Update preview when canvas changes
  useEffect(() => {
    if (!fabricCanvas) return

    const handleObjectModified = () => {
      updateTileFromFabric()
    }

    // Listen to all relevant events for live preview
    fabricCanvas.on('object:modified', handleObjectModified)
    fabricCanvas.on('object:added', handleObjectModified)
    fabricCanvas.on('object:removed', handleObjectModified)
    fabricCanvas.on('path:created', handleObjectModified)
    fabricCanvas.on('object:moving', handleObjectModified)
    fabricCanvas.on('object:scaling', handleObjectModified)
    fabricCanvas.on('object:rotating', handleObjectModified)

    // Initial update
    updateTileFromFabric()

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified)
      fabricCanvas.off('object:added', handleObjectModified)
      fabricCanvas.off('object:removed', handleObjectModified)
      fabricCanvas.off('path:created', handleObjectModified)
      fabricCanvas.off('object:moving', handleObjectModified)
      fabricCanvas.off('object:scaling', handleObjectModified)
      fabricCanvas.off('object:rotating', handleObjectModified)
    }
  }, [fabricCanvas, updateTileFromFabric])

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
        const svgGroup = fabricUtil.groupSVGElements(result.objects, result.options)

        // Scale down if too large
        const maxSize = DRAWING_TILE_SIZE * 0.8
        if (svgGroup.width! > maxSize || svgGroup.height! > maxSize) {
          const scale = maxSize / Math.max(svgGroup.width!, svgGroup.height!)
          svgGroup.scale(scale)
        }

        // Position at center of center tile
        const position = { x: DRAWING_TILE_SIZE * 1.5, y: DRAWING_TILE_SIZE * 1.5 }
        await tilingEngine.createTiledObject(svgGroup, position, currentLayerId)
        fabricCanvas.requestRenderAll()
      }).catch((err) => console.error('SVG load error:', err))
    } catch (err) {
      console.error('Failed to import SVG code:', err)
    }
  }

  const handleSVGImport = async (file: File) => {
    if (!fabricCanvas || !tilingEngine) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string

      if (file.type.includes('svg')) {
        // Handle SVG
        loadSVGFromURL(dataUrl).then(async (result: any) => {
          const svgGroup = fabricUtil.groupSVGElements(result.objects, result.options)

          // Scale down if too large
          const maxSize = DRAWING_TILE_SIZE * 0.8
          if (svgGroup.width! > maxSize || svgGroup.height! > maxSize) {
            const scale = maxSize / Math.max(svgGroup.width!, svgGroup.height!)
            svgGroup.scale(scale)
          }

          // Position at center of center tile
          const position = { x: DRAWING_TILE_SIZE * 1.5, y: DRAWING_TILE_SIZE * 1.5 }
          await tilingEngine.createTiledObject(svgGroup, position, currentLayerId)
          fabricCanvas.requestRenderAll()
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
          await tilingEngine.createTiledObject(img, position, currentLayerId)
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
    await tilingEngine.createTiledObject(cloned, position, firstObj.layerId)
    fabricCanvas.requestRenderAll()
  }

  const handleEditSVG = (mirrorGroupId: string, svgCode: string) => {
    setEditingSVGId(mirrorGroupId)
    setEditingSVGCode(svgCode)
  }

  const handleSelectEntity = (mirrorGroupId: string) => {
    if (!fabricCanvas || !layerManager) return

    // Switch to select tool
    setTool('select')

    // Get the objects in this group
    const objects = layerManager.getObjectsByMirrorGroup(mirrorGroupId)
    if (objects.length === 0) return

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
        await tilingEngine.createTiledObject(svgGroup, position, layerId)
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
      exportProjectAsJSON(fabricCanvas, layerManager, DRAWING_TILE_SIZE, filename)
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
      await importProjectFromFile(file, fabricCanvas, layerManager, tilingEngine)

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
      await deserializeProject(projectData, fabricCanvas, layerManager, tilingEngine)

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
      <header className="flex items-center px-6 py-3 bg-bg-panel border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-2xl">◫</span>
          <span className="text-xl font-semibold">Endless Tiles</span>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-bg-panel border-r border-border-subtle flex flex-col gap-4 p-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Tools</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'select'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setTool('select')}
                title="Select"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
                </svg>
              </button>
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'brush'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setTool('brush')}
                title="Brush"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/>
                </svg>
              </button>
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'eraser'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setTool('eraser')}
                title="Eraser"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z"/>
                </svg>
              </button>
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'rectangle'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setTool('rectangle')}
                title="Rectangle"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M4,6V19H20V6H4M18,17H6V8H18V17Z" />
                </svg>
              </button>
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'circle'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setTool('circle')}
                title="Circle"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
                </svg>
              </button>
              <button
                className={`p-3 rounded transition-colors ${
                  tool === 'svg'
                    ? 'bg-accent-teal/20 text-accent-teal'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
                onClick={() => setIsImportDialogOpen(true)}
                title="Import SVG"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10,19L12,15H9V10H15V15L13,19H10Z" />
                </svg>
              </button>
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
              className="w-full h-2 bg-white/10 rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent-teal [&::-webkit-slider-thumb]:rounded-full"
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
                className="flex-1 px-2 py-2 bg-white/5 border border-border-subtle rounded text-sm font-mono focus:ring-2 focus:ring-accent-teal outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  className={`w-8 h-8 rounded transition-transform ${
                    color === c ? 'ring-2 ring-accent-teal scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              className={`px-3 py-2 rounded text-sm transition-colors ${
                showZoomView
                  ? 'bg-accent-teal/20 text-accent-teal'
                  : 'bg-white/5 text-text-primary hover:bg-white/10'
              }`}
              onClick={() => setShowZoomView(!showZoomView)}
            >
              {showZoomView ? 'Hide Zoom' : 'Show Zoom'}
            </button>
            <button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
              onClick={handleImportClick}
            >
              Import File
            </button>
            <button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
              onClick={() => setIsSVGCodeDialogOpen(true)}
            >
              SVG Code
            </button>
            <button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
              onClick={clearCanvas}
            >
              Clear
            </button>
            <button
              className="px-3 py-2 bg-accent-teal hover:bg-accent-teal/90 rounded text-sm font-medium transition-colors"
              onClick={handleExportClick}
            >
              Export
            </button>
            <button
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleImportProjectClick}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Project'}
            </button>
            <button
              className="px-3 py-2 bg-accent-teal hover:bg-accent-teal/90 rounded text-sm font-medium transition-colors"
              onClick={() => setIsProjectExportDialogOpen(true)}
            >
              Export Project
            </button>
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
            <div className="flex flex-col gap-3 bg-bg-panel rounded-lg border border-border-subtle p-4 shadow-xl shrink-0">
              <span className="text-sm font-semibold text-text-primary">Draw on 3x3 Grid</span>

              <div className="relative">
                {/* Grid overlay for Fabric canvas */}
                <GridOverlay fabricCanvas={fabricCanvas} tileSize={DRAWING_TILE_SIZE} />

                {/* Fabric.js canvas - maintains aspect ratio */}
                <FabricCanvas
                  className="block"
                  visible={true}
                  onCanvasReady={setFabricCanvas}
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
              <div className="flex flex-col gap-3 bg-bg-panel rounded-lg border border-border-subtle p-4 shadow-xl shrink-0">
                <span className="text-sm font-semibold text-text-primary">Tile Result</span>
                <div className="relative">
                  <canvas
                    ref={tileCanvasRef}
                    width={DRAWING_TILE_SIZE}
                    height={DRAWING_TILE_SIZE}
                    className="block rounded border-2 border-accent-teal/30 shadow-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 bg-bg-panel border-l border-border-subtle flex flex-col gap-3 p-4 overflow-y-auto">
          <LayerPanel
            layerManager={layerManager}
            currentLayerId={currentLayerId}
            onLayerChange={setCurrentLayerId}
          />
          <CollapsiblePanel title="Objects" defaultCollapsed={false}>
            <EntityPanel
              fabricCanvas={fabricCanvas}
              layerManager={layerManager}
              currentLayerId={currentLayerId}
              selectedEntityId={selectedEntityId}
              onSelectEntity={handleSelectEntity}
              onDuplicateEntity={handleDuplicateEntity}
              onEditSVG={handleEditSVG}
            />
          </CollapsiblePanel>
          <CollapsiblePanel title="Advanced Placement" defaultCollapsed={false}>
            <PlacementPanel
              selectedObject={selectedObject}
              onUpdatePosition={updatePosition}
              onUpdateRotation={updateRotation}
              onUpdateScale={updateScale}
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
