// Slide layouts (from actual CUNY AI Lab deck framework)
export const LAYOUTS = [
  'title-slide',
  'layout-split',
  'layout-content',
  'layout-grid',
  'layout-full-dark',
  'layout-divider',
  'closing-slide',
] as const
export type SlideLayout = (typeof LAYOUTS)[number]

// Zones within layouts
export const ZONES = ['content', 'stage', 'main', 'hero'] as const
export type Zone = (typeof ZONES)[number]

// Layout → Zone mapping
export const LAYOUT_ZONES: Record<SlideLayout, Zone[]> = {
  'title-slide': ['hero'],
  'layout-split': ['content', 'stage'],
  'layout-content': ['main'],
  'layout-grid': ['main'],
  'layout-full-dark': ['main'],
  'layout-divider': ['hero'],
  'closing-slide': ['hero'],
}

// Module types
export const MODULE_TYPES = [
  'heading', 'text', 'card', 'label', 'tip-box', 'prompt-block',
  'image', 'carousel', 'comparison', 'card-grid', 'flow', 'stream-list',
  'artifact', 'video',
] as const
export type ModuleType = (typeof MODULE_TYPES)[number]

// Data shapes
export interface HeadingData { text: string; level: 1 | 2 | 3 | 4 }
export interface TextData { markdown?: string; html?: string }
export interface CardData { content: string; variant?: 'cyan' | 'navy' | 'default' }
export interface LabelData { text: string; color: 'cyan' | 'blue' | 'navy' | 'red' | 'amber' | 'green' }
export interface TipBoxData { content: string; title?: string }
export interface PromptBlockData { content: string; quality?: 'good' | 'mid' | 'bad'; language?: string }
export interface ImageData { src: string; alt: string; caption?: string; fit?: 'cover' | 'contain' }
export interface CarouselData { items: { src: string; caption?: string }[]; syncSteps?: boolean }
export interface ComparisonData { panels: { title: string; content: string }[] }
export interface CardGridData { cards: { title: string; content: string; icon?: string; color?: string }[]; columns?: 2 | 3 | 4 }
export interface FlowData { nodes: { icon?: string; label: string; description?: string }[] }
export interface StreamListData { items: string[] }
export interface ArtifactData {
  src?: string
  rawSource?: string
  config?: Record<string, unknown>
  width?: string
  height?: string
  alt?: string
  artifactId?: string
  artifactName?: string
  /**
   * When true (default), the renderer will auto-compute height to fit
   * within the canvas zone while preserving `aspectRatio`. Setting an
   * explicit `width`/`height` or resizing in the editor should switch
   * this off by setting `autoSize` to false.
   */
  autoSize?: boolean
  /**
   * Preferred aspect ratio (width / height) used when `autoSize` is
   * active and no explicit size is provided. Renderer defaults to 16/9;
   * data-viz artifacts inserted from ArtifactsTab default to 4/3.
   */
  aspectRatio?: number
}

// Artifact config schema types
export interface ArtifactConfigField {
  type: 'number' | 'string' | 'color' | 'boolean' | 'select'
  label: string
  default: unknown
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export type ArtifactConfigSchema = Record<string, ArtifactConfigField>

export interface VideoData { url: string; caption?: string }

export type ModuleDataMap = {
  heading: HeadingData
  text: TextData
  card: CardData
  label: LabelData
  'tip-box': TipBoxData
  'prompt-block': PromptBlockData
  image: ImageData
  carousel: CarouselData
  comparison: ComparisonData
  'card-grid': CardGridData
  flow: FlowData
  'stream-list': StreamListData
  artifact: ArtifactData
  video: VideoData
}
