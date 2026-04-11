export type ArtifactController = {
  update?: (config: any) => void
  destroy?: () => void
}

export type ArtifactFactory = (el: HTMLElement, config: any) => ArtifactController

const registry: Record<string, ArtifactFactory> = {}

export function registerArtifact(name: string, factory: ArtifactFactory) {
  registry[name] = factory
}

export function getArtifact(name?: string | null): ArtifactFactory | undefined {
  if (!name) return undefined
  return registry[name]
}

/** Look up a factory by display name or registryId (e.g. 'artifact-timeline' → 'Timeline') */
export function getArtifactByAny(nameOrId?: string | null): ArtifactFactory | undefined {
  if (!nameOrId) return undefined
  if (registry[nameOrId]) return registry[nameOrId]
  for (const [name, factory] of Object.entries(registry)) {
    const id = 'artifact-' + name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-')
    if (id === nameOrId) return factory
  }
  return undefined
}

