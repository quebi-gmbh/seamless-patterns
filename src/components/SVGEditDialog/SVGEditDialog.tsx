import { useState, useEffect } from 'react'
import { Modal, Dialog, Heading, Button, Label } from 'react-aria-components'
import { X } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
import { CodeEditor } from '../CodeEditor/CodeEditor'
import { extractSVGInnerContent, wrapSVGContent, validateSVGContent, extractViewBox } from '../../utils/svgUtils'

interface SVGEditDialogProps {
  isOpen: boolean
  initialCode: string
  onClose: () => void
  onSave: (svgCode: string) => void
}

export function SVGEditDialog({ isOpen, initialCode, onClose, onSave }: SVGEditDialogProps) {
  const [svgCode, setSvgCode] = useState('')
  const [originalViewBox, setOriginalViewBox] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && initialCode) {
      // Extract inner content from complete SVG
      const innerContent = extractSVGInnerContent(initialCode)
      const viewBox = extractViewBox(initialCode)

      setSvgCode(innerContent || '')
      setOriginalViewBox(viewBox)
      setError(null)
    }
  }, [isOpen, initialCode])

  if (!isOpen) return null

  const handleSave = () => {
    const trimmed = svgCode.trim()

    if (!trimmed) {
      setError('Please enter SVG content')
      return
    }

    // Validate content
    if (!validateSVGContent(trimmed)) {
      setError('Invalid SVG content')
      return
    }

    // Wrap with SVG tag, preserving original viewBox if available
    const wrappedSVG = wrapSVGContent(
      trimmed,
      100,
      100,
      originalViewBox || undefined
    )

    onSave(wrappedSVG)
    setError(null)
    onClose()
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
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
        aria-label="Edit SVG Inner Content"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Show/Edit SVG</Heading>
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
                Edit SVG elements (without &lt;svg&gt; wrapper):
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
                Tip: Press Ctrl+Enter (Cmd+Enter on Mac) to save
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
                onPress={handleSave}
                className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
                aria-label="Save changes"
              >
                Save
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
