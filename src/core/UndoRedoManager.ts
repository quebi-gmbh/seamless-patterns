import type { Command, CommandDependencies } from './commands/types'

/**
 * Manages undo/redo stacks and command execution.
 * Uses the Command Pattern to enable reversible operations.
 */
export class UndoRedoManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private maxStackSize: number
  private _isInTransaction: boolean = false
  private changeListeners: Array<() => void> = []
  private deps: CommandDependencies

  constructor(deps: CommandDependencies, maxStackSize: number = 100) {
    this.deps = deps
    this.maxStackSize = maxStackSize
  }

  /**
   * Get the command dependencies (for commands to use)
   */
  getDependencies(): CommandDependencies {
    return this.deps
  }

  /**
   * Check if currently executing an undo/redo operation.
   * Used to prevent re-entry and event loops.
   */
  isInTransaction(): boolean {
    return this._isInTransaction
  }

  /**
   * Execute a command and add it to the undo stack.
   * Clears the redo stack since we're creating new history.
   */
  execute(command: Command): void {
    // Skip if we're in the middle of undo/redo
    if (this._isInTransaction) return

    // Execute the command
    command.execute()

    // Check if we can merge with the last command
    const lastCommand = this.undoStack[this.undoStack.length - 1]
    if (lastCommand && command.canMergeWith?.(lastCommand)) {
      const merged = command.mergeWith!(lastCommand)
      this.undoStack[this.undoStack.length - 1] = merged
    } else {
      this.undoStack.push(command)
    }

    // Clear redo stack on new action
    this.redoStack = []

    // Trim if over max size
    while (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift()
    }

    this.notifyListeners()
  }

  /**
   * Undo the last command.
   * Returns true if undo was performed, false if stack was empty.
   */
  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) return false

    const command = this.undoStack.pop()!

    this._isInTransaction = true
    try {
      await command.undo()
      this.redoStack.push(command)
      this.deps.clearSelection?.()
      this.deps.requestRender?.()
    } finally {
      this._isInTransaction = false
    }

    this.notifyListeners()
    return true
  }

  /**
   * Redo the last undone command.
   * Returns true if redo was performed, false if stack was empty.
   */
  async redo(): Promise<boolean> {
    if (this.redoStack.length === 0) return false

    const command = this.redoStack.pop()!

    this._isInTransaction = true
    try {
      await command.execute()
      this.undoStack.push(command)
      this.deps.clearSelection?.()
      this.deps.requestRender?.()
    } finally {
      this._isInTransaction = false
    }

    this.notifyListeners()
    return true
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Get description of the next undo operation
   */
  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1]
    return command?.description ?? null
  }

  /**
   * Get description of the next redo operation
   */
  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1]
    return command?.description ?? null
  }

  /**
   * Clear both undo and redo stacks.
   * Call this when loading a new project or clearing the canvas.
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.notifyListeners()
  }

  /**
   * Get current stack sizes (for debugging/UI)
   */
  getStackSizes(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    }
  }

  /**
   * Register a listener for stack changes.
   * Returns an unsubscribe function.
   */
  onChanged(listener: () => void): () => void {
    this.changeListeners.push(listener)
    return () => {
      const index = this.changeListeners.indexOf(listener)
      if (index > -1) {
        this.changeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of stack changes
   */
  private notifyListeners(): void {
    this.changeListeners.forEach((listener) => listener())
  }
}
