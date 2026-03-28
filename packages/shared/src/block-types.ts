export const BLOCK_TYPES = [
  'text',
  'heading',
  'image',
  'code',
  'quote',
  'steps',
  'card-grid',
  'chart',
  'map',
  'diagram',
  'embed',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const SLIDE_TYPES = ['title', 'section-divider', 'body', 'resources'] as const
export type SlideType = (typeof SLIDE_TYPES)[number]

export interface HeadingData {
  text: string
  level: 1 | 2 | 3 | 4
}

export interface TextData {
  markdown: string
  column?: 'left' | 'right' | 'full'
}

export interface ImageData {
  src: string
  alt: string
  caption?: string
  column?: 'left' | 'right' | 'full'
}

export interface CodeData {
  language: string
  content: string
  caption?: string
  showLineNumbers?: boolean
}

export interface QuoteData {
  text: string
  attribution?: string
}

export interface StepsData {
  steps: { label: string; content: string }[]
}

export interface CardGridData {
  cards: { title: string; content: string; icon?: string; color?: string }[]
  columns?: 2 | 3 | 4
}

export interface ChartData {
  artifactId: string
  config: Record<string, unknown>
}

export interface MapData {
  artifactId: string
  config: Record<string, unknown>
}

export interface DiagramData {
  artifactId: string
  config: Record<string, unknown>
}

export interface EmbedData {
  src: string
  title?: string
  width?: number
  height?: number
}

export type BlockDataMap = {
  heading: HeadingData
  text: TextData
  image: ImageData
  code: CodeData
  quote: QuoteData
  steps: StepsData
  'card-grid': CardGridData
  chart: ChartData
  map: MapData
  diagram: DiagramData
  embed: EmbedData
}
