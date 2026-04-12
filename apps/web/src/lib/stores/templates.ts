import { writable, get } from 'svelte/store'
import { API_URL } from '$lib/api'

export interface TemplateData {
  id: string
  name: string
  layout: string
  modules: { type: string; zone: string; data: Record<string, unknown>; stepOrder?: number }[]
  thumbnail: string | null
  builtIn: boolean
}

export const templatesStore = writable<TemplateData[]>([])

let fetched = false

export async function ensureTemplatesLoaded(): Promise<TemplateData[]> {
  const existing = get(templatesStore)
  if (fetched && existing.length > 0) return existing

  fetched = true
  try {
    const res = await fetch(`${API_URL}/api/templates`, { credentials: 'include' })
    const data = await res.json()
    const templates = data.templates ?? []
    templatesStore.set(templates)
    return templates
  } catch (err) {
    console.error('Failed to fetch templates:', err)
    return []
  }
}

/** Find a template by ID */
export function findTemplateById(id: string): TemplateData | undefined {
  return get(templatesStore).find((t) => t.id === id)
}
