import { writable, get } from 'svelte/store'

interface HistoryEntry {
  mutation: Record<string, unknown>
  reverseMutation: Record<string, unknown>
}

const MAX_HISTORY = 50

function createHistory() {
  const undoStack = writable<HistoryEntry[]>([])
  const redoStack = writable<HistoryEntry[]>([])

  return {
    undoStack,
    redoStack,
    canUndo: {
      subscribe(fn: (v: boolean) => void) {
        return undoStack.subscribe((s) => fn(s.length > 0))
      },
    },
    canRedo: {
      subscribe(fn: (v: boolean) => void) {
        return redoStack.subscribe((s) => fn(s.length > 0))
      },
    },

    pushMutation(mutation: Record<string, unknown>, reverseMutation: Record<string, unknown>) {
      undoStack.update((stack) => {
        const next = [...stack, { mutation, reverseMutation }]
        if (next.length > MAX_HISTORY) next.shift()
        return next
      })
      // Clear redo stack when a new mutation is pushed
      redoStack.set([])
    },

    popUndo(): HistoryEntry | null {
      const stack = get(undoStack)
      if (stack.length === 0) return null
      const entry = stack[stack.length - 1]
      undoStack.update((s) => s.slice(0, -1))
      redoStack.update((s) => [...s, entry])
      return entry
    },

    popRedo(): HistoryEntry | null {
      const stack = get(redoStack)
      if (stack.length === 0) return null
      const entry = stack[stack.length - 1]
      redoStack.update((s) => s.slice(0, -1))
      undoStack.update((s) => [...s, entry])
      return entry
    },

    clear() {
      undoStack.set([])
      redoStack.set([])
    },
  }
}

export const history = createHistory()
