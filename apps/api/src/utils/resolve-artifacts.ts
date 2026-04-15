import { buildArtifactBlockData, type JsonValue } from '@slide-maker/shared'
import { NATIVE_ARTIFACT_NAMES } from '../export/artifacts.js'
import { db } from '../db/index.js'
import { artifacts } from '../db/schema.js'

interface ModuleData {
  type: string
  data: Record<string, unknown>
}

/**
 * Resolve artifact rawSource from catalog for modules that have artifactName but no rawSource.
 * Mutates module data in place — call before rendering to HTML.
 */
export async function resolveArtifactSources(modules: ModuleData[]): Promise<void> {
  const pending = modules.filter((m) => {
    if (m.type !== 'artifact' || m.data.rawSource) return false
    return typeof m.data.registryId === 'string' || typeof m.data.artifactName === 'string'
  })
  if (pending.length === 0) return

  const allArtifacts = await db.select().from(artifacts)
  const byName = new Map(allArtifacts.map(a => [a.name.toLowerCase(), a]))
  const byId = new Map(allArtifacts.map((artifact) => [artifact.id, artifact]))

  for (const mod of pending) {
    const registryId = typeof mod.data.registryId === 'string' ? mod.data.registryId : ''
    const name = typeof mod.data.artifactName === 'string' ? mod.data.artifactName.toLowerCase() : ''
    const def = byId.get(registryId) ?? (registryId && !registryId.startsWith('artifact-') ? byId.get(`artifact-${registryId}`) : undefined) ?? byName.get(name)
    const ref = registryId || name || '(unknown)'
    if (!def) throw new Error(`artifact-not-found:${ref}`)
    // Native artifacts are rendered by JS factory functions, not from DB source
    if (NATIVE_ARTIFACT_NAMES.has(def.name)) continue
    if (!def.source) throw new Error(`artifact-source-missing:${ref}`)
    const built = buildArtifactBlockData(
      def,
      (mod.data.config as Record<string, JsonValue>) || undefined,
      {
        alt: typeof mod.data.alt === 'string' ? mod.data.alt : undefined,
        width: typeof mod.data.width === 'string' ? mod.data.width : undefined,
        height: typeof mod.data.height === 'string' ? mod.data.height : undefined,
      },
    )
    mod.data = { ...mod.data, ...built }
  }
}
