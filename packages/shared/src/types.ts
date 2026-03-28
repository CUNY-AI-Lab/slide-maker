import type { BlockType, SlideType } from './block-types.js'
import type { Mutation } from './mutations.js'

export interface Deck {
  id: string
  name: string
  slug: string
  themeId: string | null
  metadata: DeckMetadata
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface DeckMetadata {
  author: string
  date: string
  institution?: string
}

export interface Slide {
  id: string
  deckId: string
  type: SlideType
  order: number
  notes: string | null
  fragments: boolean
  createdAt: number
  updatedAt: number
  blocks: ContentBlock[]
}

// SlideType is defined in and exported from block-types.ts to avoid circular imports

export interface ContentBlock {
  id: string
  slideId: string
  type: BlockType
  data: Record<string, unknown>
  layout: BlockLayout | null
  order: number
}

export interface BlockLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface Template {
  id: string
  name: string
  slideType: SlideType
  blocks: TemplateBlock[]
  thumbnail: string | null
  builtIn: boolean
  createdBy: string | null
}

export interface TemplateBlock {
  type: BlockType
  data: Record<string, unknown>
}

export interface Theme {
  id: string
  name: string
  css: string
  fonts: { heading: string; body: string }
  colors: { primary: string; secondary: string; accent: string; bg: string }
  builtIn: boolean
  createdBy: string | null
}

export interface User {
  id: string
  email: string
  name: string
  status: UserStatus
  role: UserRole
  emailVerified: boolean
  createdAt: number
}

export type UserStatus = 'pending' | 'approved' | 'rejected'
export type UserRole = 'admin' | 'editor' | 'viewer'

export interface ChatMessage {
  id: string
  deckId: string
  role: 'user' | 'assistant'
  content: string
  mutations: Mutation[] | null
  provider: string
  createdAt: number
}
