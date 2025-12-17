import { useState, useEffect } from 'react'
import { Modal, Dialog, Heading, Button, TextField, Label, Input } from 'react-aria-components'
import { X } from 'lucide-react'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-lg bg-bg-elevated border border-primary/20 rounded-xl shadow-2xl flex flex-col panel-glow"
        aria-label="Export Project"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Export Project</Heading>
              <Button
                onPress={close}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-white"
                aria-label="Close dialog"
              >
                <X size={18} />
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
                  className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all"
                />
                <div className="text-xs text-text-muted">
                  File will be saved as "{filename || 'project'}.tiles"
                </div>
              </TextField>

              <div className="bg-white/5 p-4 rounded-lg border border-primary/10">
                <p className="text-sm text-white mb-2">This will export your entire project including:</p>
                <ul className="text-sm text-text-muted list-disc list-inside space-y-1">
                  <li>All layers and their properties</li>
                  <li>All objects and their transforms</li>
                  <li>Layer visibility and lock states</li>
                </ul>
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
                  isDisabled={!filename.trim()}
                  className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
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
