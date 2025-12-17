import { useEffect } from 'react'
import { Modal, Dialog, Heading, Button } from 'react-aria-components'

interface RecoveryDialogProps {
  isOpen: boolean
  onRecover: () => void
  onDiscard: () => void
}

export function RecoveryDialog({ isOpen, onRecover, onDiscard }: RecoveryDialogProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDiscard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onDiscard])

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onDiscard()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Dialog
        className="relative w-full max-w-lg bg-bg-elevated border border-primary/20 rounded-xl shadow-2xl flex flex-col panel-glow"
        aria-label="Recover Session"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
          <Heading className="text-lg font-semibold text-white">Recover Session</Heading>
        </div>

        <div className="px-6 py-6 flex flex-col gap-3">
          <p className="text-white">A previous session was found. Would you like to recover it?</p>
          <p className="text-sm text-text-muted">
            Your last work was automatically saved and can be restored.
          </p>
        </div>

        <div className="flex flex-col gap-2 px-6 py-4 border-t border-primary/10">
          <div className="flex items-center justify-end gap-2">
            <Button
              onPress={onDiscard}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all hover:text-white border border-transparent hover:border-primary/20"
              aria-label="Discard session"
            >
              Discard
            </Button>
            <Button
              onPress={onRecover}
              className="px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-sm font-medium transition-all text-bg-dark shadow-[0_0_15px_rgba(45,212,168,0.3)] hover:shadow-[0_0_20px_rgba(45,212,168,0.5)]"
              aria-label="Recover session"
            >
              Recover Session
            </Button>
          </div>
          <div className="text-xs text-text-muted text-center">
            ESC to discard
          </div>
        </div>
      </Dialog>
    </Modal>
  )
}
