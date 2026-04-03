import { writable } from 'svelte/store'
import { browser } from '$app/environment'

const STORAGE_KEY = 'editor-dark-mode'

function createEditorDarkMode() {
  const initial = browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false
  const { subscribe, set, update } = writable(initial)

  return {
    subscribe,
    toggle() {
      update((v) => {
        const next = !v
        if (browser) localStorage.setItem(STORAGE_KEY, String(next))
        return next
      })
    },
    set(v: boolean) {
      set(v)
      if (browser) localStorage.setItem(STORAGE_KEY, String(v))
    },
  }
}

export const editorDarkMode = createEditorDarkMode()
