import { useState, useEffect } from 'react'
import { Modal, Dialog, Heading, Button, TextField, Label, Input } from 'react-aria-components'

interface ProjectExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (filename: string) => void
}

export function ProjectExportDialog({ isOpen, onClose, onExport }: ProjectExportDialogProps) {
  const [filename, setFilename] = useState('')

  // Generate default filename when dialog opens
  useEffect(() => {
    if (isOpen) {
      const timestamp = new Date().toISOString().split('T')[0]
      setFilename(`project-${timestamp}`)
    }
  }, [isOpen])

  const handleExport = () => {
    if (filename.trim()) {
      onExport(filename.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filename.trim()) {
      handleExport()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-lg bg-bg-elevated border border-border-subtle rounded-lg shadow-2xl flex flex-col"
        aria-label="Export Project"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <Heading className="text-lg font-semibold text-text-primary">Export Project</Heading>
              <Button
                onPress={close}
                className="p-1.5 hover:bg-white/10 rounded transition-colors text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                ✕
              </Button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              <TextField
                value={filename}
                onChange={setFilename}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex flex-col gap-2"
                aria-label="Project filename"
              >
                <Label className="text-sm font-medium text-text-muted">Filename</Label>
                <Input
                  placeholder="Enter filename"
                  className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm"
                />
                <div className="text-xs text-text-muted">
                  File will be saved as "{filename || 'project'}.tiles"
                </div>
              </TextField>

              <div className="bg-white/5 p-4 rounded border border-border-subtle">
                <p className="text-sm text-text-primary mb-2">This will export your entire project including:</p>
                <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
                  <li>All layers and their properties</li>
                  <li>All objects and their transforms</li>
                  <li>Layer visibility and lock states</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2 px-6 py-4 border-t border-border-subtle">
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
                  aria-label="Cancel"
                >
                  Cancel
                </Button>
                <Button
                  onPress={handleExport}
                  isDisabled={!filename.trim()}
                  className="px-4 py-2 bg-accent-teal hover:bg-accent-teal/90 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Export project"
                >
                  Export Project
                </Button>
              </div>
              <div className="text-xs text-text-muted text-center">
                Press Enter to export • ESC to cancel
              </div>
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
