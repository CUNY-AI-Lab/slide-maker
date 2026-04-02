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
  const pending = modules.filter(m => m.type === 'artifact' && m.data.artifactName && !m.data.rawSource)
  if (pending.length === 0) return

  const allArtifacts = await db.select().from(artifacts)
  const byName = new Map(allArtifacts.map(a => [a.name.toLowerCase(), a]))

  for (const mod of pending) {
    const name = String(mod.data.artifactName).toLowerCase()
    const def = byName.get(name)
    if (!def?.source) continue

    // Extract schema defaults
    const cfg = (def.config && typeof def.config === 'object') ? def.config as Record<string, unknown> : {}
    const defaults: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(cfg)) {
      if (v && typeof v === 'object' && 'default' in (v as Record<string, unknown>)) {
        defaults[k] = (v as Record<string, unknown>).default
      }
    }

    const userCfg = (mod.data.config && typeof mod.data.config === 'object') ? mod.data.config as Record<string, unknown> : {}
    const merged = { ...defaults, ...userCfg }

    // Inject config into source HTML via data-config attribute
    const configStr = JSON.stringify(merged).replace(/"/g, '&quot;')
    let src = def.source
    const replaced = src.replace(
      /<body([^>]*?)\sdata-config="[^"]*"([^>]*)>/i,
      (_m: string, pre: string, post: string) => `<body${pre} data-config="${configStr}"${post}>`,
    )
    if (replaced !== src) {
      src = replaced
    } else if (src.includes('<body>')) {
      src = src.replace('<body>', `<body data-config="${configStr}">`)
    } else if (src.includes('<body ')) {
      src = src.replace('<body ', `<body data-config="${configStr}" `)
    }

    mod.data.rawSource = src
    mod.data.config = merged
  }
}
