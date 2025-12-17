import { useRef } from 'react'
import { Modal, Dialog, Heading, Button } from 'react-aria-components'
import { X, FolderOpen } from 'lucide-react'

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (file: File) => void
}

export function ImportDialog({ isOpen, onClose, onImport }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImport(file)
      onClose()
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files[0]
    if (file && (file.type.includes('svg') || file.type.includes('image'))) {
      onImport(file)
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
        aria-label="Import SVG or Image"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
              <Heading className="text-lg font-semibold text-white">Import SVG or Image</Heading>
              <Button
                onPress={close}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-text-muted hover:text-white"
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="px-6 py-8">
              <div
                className="border-2 border-dashed border-primary/20 rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all bg-white/5"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <FolderOpen size={48} className="text-primary" />
                  <p className="text-white font-medium">Drop your file here</p>
                  <p className="text-sm text-text-muted">or</p>
                  <Button
                    className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
                    aria-label="Browse files"
                  >
                    Browse Files
                  </Button>
                  <p className="text-xs text-text-muted">Supports: SVG, PNG, JPEG</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </>
        )}
      </Dialog>
    </Modal>
  )
}
