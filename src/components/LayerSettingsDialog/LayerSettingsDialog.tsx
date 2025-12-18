import { useState, useEffect } from 'react'
import { Modal, Dialog, Heading, Button, Label, Slider, SliderTrack, SliderThumb, SliderOutput } from 'react-aria-components'
import { X } from 'lucide-react'
import type { Layer } from '../../core/LayerManager'

interface LayerSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  layer: Layer | null
  onUpdate: (layerId: string, updates: Partial<Layer>) => void
}

export function LayerSettingsDialog({ isOpen, onClose, layer, onUpdate }: LayerSettingsDialogProps) {
  const [backgroundColor, setBackgroundColor] = useState<string>('#000000')
  const [backgroundAlpha, setBackgroundAlpha] = useState<number>(100)
  const [hasBackground, setHasBackground] = useState<boolean>(false)

  // Sync state when layer changes or dialog opens
  useEffect(() => {
    if (layer && isOpen) {
      if (layer.backgroundColor) {
        setBackgroundColor(layer.backgroundColor)
        setHasBackground(true)
      } else {
        setBackgroundColor('#000000')
        setHasBackground(false)
      }
      setBackgroundAlpha(Math.round((layer.backgroundAlpha ?? 1) * 100))
    }
  }, [layer, isOpen])

  const handleApply = () => {
    if (!layer) return

    onUpdate(layer.id, {
      backgroundColor: hasBackground ? backgroundColor : undefined,
      backgroundAlpha: hasBackground ? backgroundAlpha / 100 : undefined,
    })
    onClose()
  }

  const handleClear = () => {
    setHasBackground(false)
    setBackgroundColor('#000000')
    setBackgroundAlpha(100)
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
        handleApply()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleApply])

  if (!layer) return null

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-md bg-bg-elevated border border-primary/20 rounded-xl shadow-2xl flex flex-col panel-glow"
        aria-label="Layer Settings"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Layer Settings</Heading>
              <Button
                onPress={close}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-white"
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 px-6 py-4 flex flex-col gap-4">
              <div className="text-sm text-text-muted">
                Layer: <span className="text-white">{layer.name}</span>
              </div>

              {/* Background toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBackground}
                    onChange={(e) => setHasBackground(e.target.checked)}
                    className="w-4 h-4 rounded border-primary/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="text-sm text-white">Enable background color</span>
                </label>
              </div>

              {/* Color picker */}
              <div className={`flex flex-col gap-2 ${!hasBackground ? 'opacity-40 pointer-events-none' : ''}`}>
                <Label className="text-sm font-medium text-text-muted">Background Color</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-primary/20 bg-transparent"
                    />
                  </div>
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        setBackgroundColor(val)
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-white/5 border border-primary/20 rounded-lg text-sm text-white font-mono focus:ring-2 focus:ring-primary outline-none"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* Alpha slider */}
              <div className={`flex flex-col gap-2 ${!hasBackground ? 'opacity-40 pointer-events-none' : ''}`}>
                <Slider
                  value={[backgroundAlpha]}
                  onChange={(val) => setBackgroundAlpha(val[0])}
                  minValue={0}
                  maxValue={100}
                  step={1}
                  className="flex flex-col gap-2"
                  aria-label="Background Opacity"
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-text-muted">Opacity</Label>
                    <SliderOutput className="text-sm text-text-muted">
                      {({state}) => `${state.values[0]}%`}
                    </SliderOutput>
                  </div>
                  <SliderTrack className="relative w-full h-2 bg-white/10 rounded-lg">
                    <SliderThumb className="h-4 w-4 bg-primary rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-[0_0_10px_rgba(45,212,168,0.4)] transition-all hover:scale-110" />
                  </SliderTrack>
                </Slider>
              </div>

              {/* Preview */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-text-muted">Preview</Label>
                <div
                  className="h-16 rounded-lg border border-primary/20 overflow-hidden"
                  style={{
                    backgroundImage: hasBackground
                      ? `linear-gradient(45deg, #808080 25%, transparent 25%),
                         linear-gradient(-45deg, #808080 25%, transparent 25%),
                         linear-gradient(45deg, transparent 75%, #808080 75%),
                         linear-gradient(-45deg, transparent 75%, #808080 75%)`
                      : 'none',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    backgroundColor: '#404040',
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: hasBackground ? backgroundColor : 'transparent',
                      opacity: hasBackground ? backgroundAlpha / 100 : 0,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 px-6 py-4 border-t border-primary/10">
              <div className="flex items-center justify-between gap-2">
                <Button
                  onPress={handleClear}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
                  aria-label="Clear background"
                >
                  Clear
                </Button>
                <div className="flex gap-2">
                  <Button
                    onPress={close}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
                    aria-label="Cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={handleApply}
                    className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
                    aria-label="Apply settings"
                  >
                    Apply
                  </Button>
                </div>
              </div>
              <div className="text-xs text-text-muted text-center">
                Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to apply, ESC to close
              </div>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
