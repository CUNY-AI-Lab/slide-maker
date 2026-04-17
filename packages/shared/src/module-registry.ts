import type { ModuleType } from './block-types.js'

export interface ModuleFactoryConfig {
  [key: string]: unknown
}

export interface ModuleRegistryFactory {
  defaults: Record<string, unknown>
  create: (config?: ModuleFactoryConfig) => Record<string, unknown>
}

export interface ModuleRegistryEntry {
  type: ModuleType
  label: string
  icon: string
  factory: ModuleRegistryFactory
}

function mergeFactoryConfig(
  defaults: Record<string, unknown>,
  config?: ModuleFactoryConfig,
): Record<string, unknown> {
  return config ? { ...defaults, ...config } : { ...defaults }
}

function makeFactory(defaults: Record<string, unknown>): ModuleRegistryFactory {
  return {
    defaults,
    create: (config?: ModuleFactoryConfig) => mergeFactoryConfig(defaults, config),
  }
}

export const MODULE_REGISTRY_LIST: ModuleRegistryEntry[] = [
  { type: 'heading', label: 'Heading', icon: 'H', factory: makeFactory({ text: '', level: 2 }) },
  { type: 'text', label: 'Text', icon: '¶', factory: makeFactory({ markdown: '' }) },
  { type: 'card', label: 'Card', icon: '▭', factory: makeFactory({ content: '', variant: 'default' }) },
  { type: 'label', label: 'Label', icon: '◉', factory: makeFactory({ text: '', color: 'cyan' }) },
  { type: 'tip-box', label: 'Callout', icon: '💡', factory: makeFactory({ title: '', content: '' }) },
  { type: 'prompt-block', label: 'Code Block', icon: '⌨', factory: makeFactory({ content: '', quality: 'good', language: '' }) },
  { type: 'image', label: 'Image', icon: '🖼', factory: makeFactory({ src: '', alt: '', caption: '' }) },
  { type: 'carousel', label: 'Carousel', icon: '⟳', factory: makeFactory({ items: [], syncSteps: false }) },
  {
    type: 'comparison',
    label: 'Comparison',
    icon: '⟺',
    factory: makeFactory({ panels: [{ title: '', content: '' }, { title: '', content: '' }] }),
  },
  {
    type: 'flow',
    label: 'Process Flow',
    icon: '↓',
    factory: makeFactory({ nodes: [{ label: 'Step 1' }, { label: 'Step 2' }] }),
  },
  {
    type: 'video',
    label: 'Video',
    icon: '▶',
    factory: makeFactory({ url: '', caption: '' }),
  },
]

export const MODULE_REGISTRY: Record<ModuleType, ModuleRegistryEntry> = Object.fromEntries(
  MODULE_REGISTRY_LIST.map((entry) => [entry.type, entry]),
) as Record<ModuleType, ModuleRegistryEntry>

export function getModuleRegistryEntry(type: ModuleType | string): ModuleRegistryEntry | null {
  return MODULE_REGISTRY[type as ModuleType] ?? null
}

export function createModuleData(
  type: ModuleType | string,
  config?: ModuleFactoryConfig,
): Record<string, unknown> {
  const entry = getModuleRegistryEntry(type)
  if (!entry) return config ? { ...config } : {}
  return entry.factory.create(config)
}
