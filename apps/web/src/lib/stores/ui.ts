import { writable } from 'svelte/store'
import { logAction } from './actions'

export const activeSlideId = writable<string | null>(null)

/** Set active slide and log action for AI context */
export function setActiveSlide(id: string | null, slideNumber?: number) {
  activeSlideId.set(id)
  if (id && slideNumber !== undefined) {
    logAction(`Selected slide ${slideNumber}`)
  }
}
export const activeResourceTab = writable<'files' | 'templates' | 'artifacts'>('files')
export const rightPanelOpen = writable(true)
export const activeModuleControls = writable<string | null>(null)
