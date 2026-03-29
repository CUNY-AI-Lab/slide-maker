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
  'viz',
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
export interface VizData {
  viz: 'lorenz' | 'boids' | 'life' | 'fourier' | 'rd' | 'mandelbrot' | 'nbody' | 'percolation' | 'logistic' | 'voronoi'
  options?: Record<string, unknown>
}

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
  viz: VizData
}
