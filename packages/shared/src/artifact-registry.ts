export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface ArtifactConfigField {
  type: string
  label: string
  default: JsonValue
  enum?: JsonValue[]
  itemShape?: Record<string, string>
}

export interface ArtifactFactorySpec {
  kind?: 'html-data-attribute' | 'url-json-param'
  key?: string
}

export interface ArtifactRegistryEntry {
  id: string
  name: string
  description: string
  type: string
  source: string
  config: Record<string, ArtifactConfigField> | unknown
  factory?: ArtifactFactorySpec | null
}

export interface ArtifactBlockBuildOptions {
  alt?: string
  width?: string
  height?: string
}

const FRAME_CONFIG_KEYS = new Set(['width', 'height', 'alt', 'sandbox'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isArtifactConfigField(value: unknown): value is ArtifactConfigField {
  return isRecord(value) && 'default' in value
}

export function getResolvedConfig(artifact: ArtifactRegistryEntry): Record<string, JsonValue> {
  const cfg = artifact.config as Record<string, unknown> | null
  if (!cfg || typeof cfg !== 'object') return {}

  const hasSchema = Object.values(cfg).some((value) => isArtifactConfigField(value))

  if (hasSchema) {
    const defaults: Record<string, JsonValue> = {}
    for (const [key, value] of Object.entries(cfg)) {
      if (isArtifactConfigField(value)) {
        defaults[key] = value.default
      }
    }
    return defaults
  }

  return cfg as Record<string, JsonValue>
}

export function resolveArtifactFactory(artifact: ArtifactRegistryEntry): ArtifactFactorySpec {
  if (artifact.factory && typeof artifact.factory === 'object') {
    return {
      kind: artifact.factory.kind || (/^https?:\/\//i.test(artifact.source) ? 'url-json-param' : 'html-data-attribute'),
      key: artifact.factory.key || (artifact.factory.kind === 'url-json-param' ? 'config' : 'data-config'),
    }
  }

  return /^https?:\/\//i.test(artifact.source)
    ? { kind: 'url-json-param', key: 'config' }
    : { kind: 'html-data-attribute', key: 'data-config' }
}

function getRuntimeConfig(config: Record<string, JsonValue>): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !FRAME_CONFIG_KEYS.has(key)),
  )
}

function applyFactoryToSource(
  source: string,
  runtimeConfig: Record<string, JsonValue>,
  factory: ArtifactFactorySpec,
): string {
  if (Object.keys(runtimeConfig).length === 0) return source

  if (factory.kind === 'url-json-param' || /^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source)
      url.searchParams.set(factory.key || 'config', JSON.stringify(runtimeConfig))
      return url.toString()
    } catch {
      return source
    }
  }

  const attrName = factory.key || 'data-config'
  const configStr = JSON.stringify(runtimeConfig).replace(/"/g, '&quot;')

  if (source.includes('<body>')) {
    return source.replace('<body>', `<body ${attrName}="${configStr}">`)
  }
  if (source.includes('<body ')) {
    return source.replace('<body ', `<body ${attrName}="${configStr}" `)
  }

  return source
}

export function buildArtifactBlockData(
  artifact: ArtifactRegistryEntry,
  config: Record<string, JsonValue> = getResolvedConfig(artifact),
  options: ArtifactBlockBuildOptions = {},
): Record<string, unknown> {
  const factory = resolveArtifactFactory(artifact)
  const runtimeConfig = getRuntimeConfig(config)
  const alt =
    options.alt ||
    (typeof config.alt === 'string' ? config.alt : artifact.name) ||
    'Interactive visualization'
  const width =
    options.width ||
    (typeof config.width === 'string' ? config.width : '100%')
  const height =
    options.height ||
    (typeof config.height === 'string' ? config.height : '400px')

  const data: Record<string, unknown> = {
    registryId: artifact.id,
    artifactId: artifact.id,
    artifactName: artifact.name,
    config,
    factory,
    alt,
    width,
    height,
    autoSize: true,
    aspectRatio: 16 / 9,
  }

  const source = applyFactoryToSource(artifact.source, runtimeConfig, factory)
  if (/^https?:\/\//i.test(artifact.source)) {
    data.src = source
  } else {
    data.rawSource = source
  }

  return data
}

export function buildAtRef(
  artifact: ArtifactRegistryEntry,
  config: Record<string, JsonValue> = getResolvedConfig(artifact),
): string {
  const payload = {
    id: artifact.id,
    name: artifact.name,
    type: artifact.type,
    source: artifact.source,
    config,
    factory: resolveArtifactFactory(artifact),
  }
  const json = JSON.stringify(payload, null, 2)
  return `@artifact:${artifact.name}\n\`\`\`json\n${json}\n\`\`\``
}
