import { useState, useEffect, useCallback } from 'react'
import type { UndoRedoManager } from '../core/UndoRedoManager'

interface UseUndoRedoResult {
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<void>
  redo: () => Promise<void>
  undoDescription: string | null
  redoDescription: string | null
  stackSizes: { undo: number; redo: number }
}

/**
 * React hook for undo/redo functionality.
 * Provides keyboard shortcuts and state for UI.
 */
export function useUndoRedo(undoRedoManager: UndoRedoManager | null): UseUndoRedoResult {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [undoDescription, setUndoDescription] = useState<string | null>(null)
  const [redoDescription, setRedoDescription] = useState<string | null>(null)
  const [stackSizes, setStackSizes] = useState({ undo: 0, redo: 0 })

  // Update state from manager
  const updateState = useCallback(() => {
    if (!undoRedoManager) {
      setCanUndo(false)
      setCanRedo(false)
      setUndoDescription(null)
      setRedoDescription(null)
      setStackSizes({ undo: 0, redo: 0 })
      return
    }

    setCanUndo(undoRedoManager.canUndo())
    setCanRedo(undoRedoManager.canRedo())
    setUndoDescription(undoRedoManager.getUndoDescription())
    setRedoDescription(undoRedoManager.getRedoDescription())
    setStackSizes(undoRedoManager.getStackSizes())
  }, [undoRedoManager])

  // Subscribe to manager changes
  useEffect(() => {
    if (!undoRedoManager) return

    const unsubscribe = undoRedoManager.onChanged(updateState)
    updateState() // Initial state

    return unsubscribe
  }, [undoRedoManager, updateState])

  // Undo action
  const undo = useCallback(async () => {
    if (!undoRedoManager) return
    await undoRedoManager.undo()
  }, [undoRedoManager])

  // Redo action
  const redo = useCallback(async () => {
    if (!undoRedoManager) return
    await undoRedoManager.redo()
  }, [undoRedoManager])

  // Keyboard shortcuts
  useEffect(() => {
    if (!undoRedoManager) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input field
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Ctrl/Cmd + Z for undo
      if (modKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRedoManager.undo()
        return
      }

      // Ctrl/Cmd + Shift + Z for redo
      if (modKey && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        undoRedoManager.redo()
        return
      }

      // Ctrl/Cmd + Y for redo (Windows/Linux convention)
      if (modKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        undoRedoManager.redo()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoRedoManager])

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    undoDescription,
    redoDescription,
    stackSizes,
  }
}
