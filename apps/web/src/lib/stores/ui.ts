import { writable } from 'svelte/store'

export const activeSlideId = writable<string | null>(null)
export const activeResourceTab = writable<'files' | 'templates' | 'artifacts' | 'themes'>('templates')
export const rightPanelOpen = writable(true)
export const activeModuleControls = writable<string | null>(null)
