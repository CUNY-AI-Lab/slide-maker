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

