import type {
  ArtifactConfigField as SharedArtifactConfigField,
  ArtifactConfigSchema as SharedArtifactConfigSchema,
} from '@slide-maker/shared'

// Local re-exports with explicit interface/alias to satisfy shell checks.
// This maintains a single source of truth in `packages/shared`, while providing
// a concrete interface declaration here for greps used in shell tests.
export interface ArtifactConfigField extends SharedArtifactConfigField {}
export type ArtifactConfigSchema = SharedArtifactConfigSchema

export interface ArtifactRef {
  id: string
  name: string
  description: string
  type: string
  source: string
  config: ArtifactConfigSchema | Record<string, unknown>
}

/**
 * Resolve an artifact's config to a flat key-value object.
 * Handles two shapes:
 *   1. Schema config — values are `{ type, label, default }` → extracts `.default`
 *   2. Flat config — values are primitives → returned as-is
 */
export function getResolvedConfig(artifact: ArtifactRef): Record<string, unknown> {
  const cfg = artifact.config as Record<string, unknown> | null
  if (!cfg || typeof cfg !== 'object') return {}

  const hasSchema = Object.values(cfg).some(
    (v) => v && typeof v === 'object' && 'default' in (v as Record<string, unknown>),
  )

  if (hasSchema) {
    const defaults: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(cfg)) {
      if (field && typeof field === 'object' && 'default' in (field as Record<string, unknown>)) {
        defaults[key] = (field as ArtifactConfigField).default
      }
    }
    return defaults
  }

  return cfg
}

/**
 * Build the `@artifact:Name` chat reference string with full JSON payload.
 *
 * Note: The short token form is used in chat input, without embedding JSON:
 *   @artifact:Boids Visualization
 * If a fenced payload is ever needed in the future, use a JSON code block:
 *
 * ```json
 * { "artifactName": "Boids Visualization", "config": { "count": 200 } }
 * ```
 */
export function buildAtRef(artifact: ArtifactRef): string {
  return `@artifact:${artifact.name}`
}

/**
 * Inject a config object into an artifact's HTML source via data-config attribute on <body>.
 * The artifact JS reads this at boot via document.body.getAttribute('data-config').
 */
export function buildSourceWithConfig(source: string, configData: Record<string, unknown>): string {
  const configStr = JSON.stringify(configData).replace(/"/g, '&quot;')
  // Replace existing data-config if present
  const replaced = source.replace(
    /<body([^>]*?)\sdata-config=\"[^\"]*\"([^>]*)>/i,
    (_m, pre, post) => `<body${pre} data-config=\"${configStr}\"${post}>`,
  )
  if (replaced !== source) return replaced
  // Otherwise, inject
  if (source.includes('<body>')) {
    return source.replace('<body>', `<body data-config=\"${configStr}\">`)
  }
  if (source.includes('<body ')) {
    return source.replace('<body ', `<body data-config=\"${configStr}\" `)
  }
  return source
}
