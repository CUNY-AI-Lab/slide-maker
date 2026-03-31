import { writable, get } from 'svelte/store'
import type { ArtifactConfigSchema } from '@slide-maker/shared'
import { API_URL } from '$lib/api'

export interface ArtifactDef {
  id: string
  name: string
  description: string
  type: string
  source: string
  config: ArtifactConfigSchema | Record<string, unknown>
  builtIn: boolean
}

export const artifactsStore = writable<ArtifactDef[]>([])

let fetched = false

export async function ensureArtifactsLoaded(): Promise<ArtifactDef[]> {
  const existing = get(artifactsStore)
  if (fetched && existing.length > 0) return existing

  fetched = true
  try {
    const res = await fetch(`${API_URL}/api/artifacts`, { credentials: 'include' })
    const data = await res.json()
    const artifacts = data.artifacts ?? []
    artifactsStore.set(artifacts)
    return artifacts
  } catch (err) {
    console.error('Failed to fetch artifacts:', err)
    return []
  }
}

/** Find an artifact definition by name (case-insensitive partial match) */
export function findArtifactByName(name: string): ArtifactDef | undefined {
  const artifacts = get(artifactsStore)
  const lower = name.toLowerCase()
  return artifacts.find((a) => a.name.toLowerCase() === lower)
    ?? artifacts.find((a) => a.name.toLowerCase().includes(lower))
}
