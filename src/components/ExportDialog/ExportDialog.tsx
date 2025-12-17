import { useState, useEffect, useCallback } from 'react'
import { Modal, Dialog, Heading, Button, Label, Slider, SliderTrack, SliderThumb, SliderOutput, Switch } from 'react-aria-components'
import { X } from 'lucide-react'
import type { Canvas as FabricCanvasType } from 'fabric'
import { generateCenterTileSVG, rasterizeSVG, convertFormat, downloadFile } from '../../utils/svgExport'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  fabricCanvas: FabricCanvasType | null
  tileSize: number
}

type ExportFormat = 'png' | 'jpeg' | 'bmp' | 'svg'

const RESOLUTION_OPTIONS = [128, 256, 512, 1024, 2048, 4096]

export function ExportDialog({ isOpen, onClose, fabricCanvas, tileSize }: ExportDialogProps) {
  const [resolution, setResolution] = useState(1024)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [jpegQuality, setJpegQuality] = useState(95)
  const [imageSmoothingEnabled, setImageSmoothingEnabled] = useState(true)
  const [enableRetinaScaling, setEnableRetinaScaling] = useState(false)
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Update preview when options change
  const updatePreview = useCallback(async () => {
    if (!fabricCanvas) return

    try {
      // Generate SVG from center tile
      const svgString = generateCenterTileSVG(fabricCanvas, tileSize)

      if (format === 'svg') {
        // For SVG preview, rasterize at fixed preview size (256px)
        const previewDataUrl = await rasterizeSVG(svgString, 256, 256, true)
        setPreviewDataUrl(previewDataUrl)
      } else {
        // For raster formats, generate at target resolution
        const pngDataUrl = await rasterizeSVG(
          svgString,
          resolution,
          resolution,
          imageSmoothingEnabled
        )

        // Convert format if needed
        if (format === 'png') {
          setPreviewDataUrl(pngDataUrl)
        } else if (format === 'jpeg' || format === 'bmp') {
          const finalDataUrl = await convertFormat(
            pngDataUrl,
            format,
            format === 'jpeg' ? jpegQuality / 100 : 1
          )
          setPreviewDataUrl(finalDataUrl)
        }
      }
    } catch (error) {
      console.error('Failed to generate preview:', error)
    }
  }, [fabricCanvas, resolution, format, jpegQuality, imageSmoothingEnabled, tileSize])

  // Debounced preview update
  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(() => {
      updatePreview()
    }, 300)

    return () => clearTimeout(timer)
  }, [isOpen, updatePreview])

  // Generate filename
  const generateFileName = () => {
    if (format === 'svg') {
      return `tile.svg`
    }
    const extension = format === 'jpeg' ? 'jpg' : format
    return `tile-${resolution}.${extension}`
  }

  // Handle SVG export
  const handleSVGExport = async () => {
    if (!fabricCanvas) return

    try {
      const svgString = generateCenterTileSVG(fabricCanvas, tileSize)
      downloadFile(svgString, generateFileName(), 'image/svg+xml')
    } catch (error) {
      console.error('SVG export failed:', error)
    }
  }

  // Handle raster export (PNG, JPEG, BMP)
  const handleRasterExport = async () => {
    if (!fabricCanvas) return

    try {
      // Generate SVG first
      const svgString = generateCenterTileSVG(fabricCanvas, tileSize)

      // Rasterize at target resolution
      const pngDataUrl = await rasterizeSVG(
        svgString,
        resolution,
        resolution,
        imageSmoothingEnabled
      )

      // Convert to target format if needed
      if (format === 'png') {
        downloadFile(pngDataUrl, generateFileName())
      } else if (format === 'jpeg' || format === 'bmp') {
        const finalDataUrl = await convertFormat(
          pngDataUrl,
          format,
          format === 'jpeg' ? jpegQuality / 100 : 1
        )
        downloadFile(finalDataUrl, generateFileName())
      }
    } catch (error) {
      console.error('Raster export failed:', error)
    }
  }

  // Handle export
  const handleExport = async () => {
    if (!fabricCanvas || isExporting) return

    setIsExporting(true)

    try {
      if (format === 'svg') {
        await handleSVGExport()
      } else {
        await handleRasterExport()
      }
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleExport()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleExport])

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-4xl max-h-[90vh] bg-bg-elevated border border-primary/20 rounded-xl shadow-2xl flex flex-col panel-glow"
        aria-label="Export Tile"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Export Tile</Heading>
              <Button
                onPress={close}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-white"
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex gap-6">
              {/* Options Panel */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Resolution Selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-text-muted">
                    Resolution{format === 'svg' ? ' (N/A for SVG)' : ''}
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {RESOLUTION_OPTIONS.map((size) => (
                      <Button
                        key={size}
                        onPress={() => setResolution(size)}
                        isDisabled={format === 'svg'}
                        className={`px-3 py-2 rounded-lg text-sm transition-all ${
                          resolution === size
                            ? 'bg-primary/20 text-primary shadow-[0_0_8px_rgba(45,212,168,0.2)]'
                            : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                        aria-label={`Set resolution to ${size} pixels`}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Format Selector */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-text-muted">Format</Label>
                  <div className="flex gap-2">
                    {(['png', 'jpeg', 'bmp', 'svg'] as const).map((fmt) => (
                      <Button
                        key={fmt}
                        onPress={() => setFormat(fmt)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                          format === fmt
                            ? 'bg-primary/20 text-primary shadow-[0_0_8px_rgba(45,212,168,0.2)]'
                            : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                        }`}
                        aria-label={`Export as ${fmt.toUpperCase()}`}
                      >
                        {fmt.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  {format === 'jpeg' && (
                    <div className="text-xs text-text-muted bg-white/5 p-2 rounded-lg border border-primary/10">
                      Note: JPEG does not support transparency
                    </div>
                  )}
                  {format === 'svg' && (
                    <div className="text-xs text-text-muted bg-white/5 p-2 rounded-lg border border-primary/10">
                      SVG exports as scalable vector graphics
                    </div>
                  )}
                </div>

                {/* JPEG Quality Slider */}
                {format === 'jpeg' && (
                  <Slider
                    value={[jpegQuality]}
                    onChange={(val) => setJpegQuality(val[0])}
                    minValue={1}
                    maxValue={100}
                    step={1}
                    className="flex flex-col gap-2"
                    aria-label="JPEG Quality"
                  >
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium text-text-muted">Quality</Label>
                      <SliderOutput className="text-sm text-text-muted">
                        {({state}) => `${state.values[0]}%`}
                      </SliderOutput>
                    </div>
                    <SliderTrack className="relative w-full h-2 bg-white/10 rounded-lg">
                      <SliderThumb className="h-4 w-4 bg-primary rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-[0_0_10px_rgba(45,212,168,0.4)] transition-all hover:scale-110" />
                    </SliderTrack>
                  </Slider>
                )}

                {/* Rendering Options */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-text-muted">Rendering Options</Label>
                  <Switch
                    isSelected={imageSmoothingEnabled}
                    onChange={setImageSmoothingEnabled}
                    className="group flex items-center gap-2"
                  >
                    <div className="flex h-5 w-9 items-center rounded-full bg-white/10 px-0.5 transition-all group-data-selected:bg-primary group-data-selected:shadow-[0_0_10px_rgba(45,212,168,0.3)]">
                      <span className="h-4 w-4 rounded-full bg-white transition group-data-selected:translate-x-4" />
                    </div>
                    <Label className="text-sm text-white cursor-pointer">Enable Antialiasing</Label>
                  </Switch>
                  <Switch
                    isSelected={enableRetinaScaling}
                    onChange={setEnableRetinaScaling}
                    className="group flex items-center gap-2"
                  >
                    <div className="flex h-5 w-9 items-center rounded-full bg-white/10 px-0.5 transition-all group-data-selected:bg-primary group-data-selected:shadow-[0_0_10px_rgba(45,212,168,0.3)]">
                      <span className="h-4 w-4 rounded-full bg-white transition group-data-selected:translate-x-4" />
                    </div>
                    <Label className="text-sm text-white cursor-pointer">Enable Retina Scaling</Label>
                  </Switch>
                </div>
              </div>

              {/* Preview Panel */}
              <div className="w-80 flex flex-col gap-2">
                <Label className="text-sm font-medium text-text-muted">Preview</Label>
                <div className="aspect-square bg-white/5 border border-primary/20 rounded-xl overflow-hidden flex items-center justify-center">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt="Export preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-text-muted">Generating preview...</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-xs text-text-muted">
                  <div>{resolution} × {resolution}</div>
                  <div>{format.toUpperCase()}</div>
                  <div className="font-mono truncate">{generateFileName()}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 px-6 py-4 border-t border-primary/10">
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
                  aria-label="Cancel"
                >
                  Cancel
                </Button>
                <Button
                  onPress={handleExport}
                  isDisabled={isExporting}
                  className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isExporting ? 'Exporting...' : 'Export tile'}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
              <div className="text-xs text-text-muted text-center">
                Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to export, ESC to close
              </div>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
