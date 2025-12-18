import { useState, useEffect } from 'react'
import { Modal, Dialog, Heading, Button, Label } from 'react-aria-components'
import { X } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
import { CodeEditor } from '../CodeEditor/CodeEditor'
import { wrapSVGContent, validateSVGContent } from '../../utils/svgUtils'

interface SVGCodeDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (svgCode: string) => void
}

const DEFAULT_SVG = `<circle cx="50" cy="50" r="40" fill="red" />`

export function SVGCodeDialog({ isOpen, onClose, onImport }: SVGCodeDialogProps) {
  const [svgCode, setSvgCode] = useState(DEFAULT_SVG)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset to default SVG when opening
      setSvgCode(DEFAULT_SVG)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleImport = () => {
    const trimmed = svgCode.trim()

    if (!trimmed) {
      setError('Please enter SVG content')
      return
    }

    // Validate the content
    if (!validateSVGContent(trimmed)) {
      setError('Invalid SVG content')
      return
    }

    // Wrap with SVG tag before importing
    const wrappedSVG = wrapSVGContent(trimmed)

    onImport(wrappedSVG)
    setSvgCode('')
    setError(null)
    onClose()
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + Enter to import
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleImport()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-3xl max-h-[90vh] bg-bg-elevated border border-primary/20 rounded-xl shadow-2xl flex flex-col panel-glow"
        aria-label="Import SVG Code"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Import SVG Code</Heading>
              <Tooltip content="Close">
                <Button
                  onPress={close}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-white"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </Button>
              </Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              <Label className="text-sm text-text-muted">
                Paste or write SVG elements (without &lt;svg&gt; wrapper):
              </Label>
              <CodeEditor
                value={svgCode}
                onChange={(value) => {
                  setSvgCode(value)
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                autoFocus={true}
              />
              {error && <div className="text-sm text-accent-coral">{error}</div>}

              <div className="text-xs text-text-muted bg-white/5 p-3 rounded-lg border border-primary/10">
                Example: &lt;circle cx="50" cy="50" r="40" fill="red" /&gt;
                <br />
                Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to import
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-primary/10">
              <Button
                onPress={close}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
                aria-label="Cancel"
              >
                Cancel
              </Button>
              <Button
                onPress={handleImport}
                className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
                aria-label="Import SVG"
              >
                Import
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
