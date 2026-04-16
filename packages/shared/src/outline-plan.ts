import type { SlideLayout, ModuleType, Zone } from './block-types.js'

export type FidelityMode = 'strict' | 'balanced' | 'interpretive'

export type OutlineNodeKind =
  | 'deckTitle'
  | 'section'
  | 'bullet'
  | 'paragraph'
  | 'quote'
  | 'figure'
  | 'notes'

export interface OutlineNode {
  id: string
  kind: OutlineNodeKind
  text: string
  children: OutlineNode[]
  source: { fileId: string; start: number; end: number }
  locked?: boolean
}

export type SlidePurpose =
  | 'title'
  | 'divider'
  | 'content'
  | 'quote'
  | 'visual'
  | 'closing'

export interface PlannedModule {
  type: ModuleType
  zone: Zone
  data: Record<string, unknown>
  stepOrder?: number
  sourceNodeIds?: string[]
}

export interface PlannedSlide {
  planId: string
  sourceNodeIds: string[]
  purpose: SlidePurpose
  layout: SlideLayout
  title: string
  fidelity: FidelityMode
  modules: PlannedModule[]
  notes?: string
}

export interface DeckPlan {
  outlineTree: OutlineNode[]
  estimatedSlideCount: { min: number; max: number }
  fidelity: FidelityMode
  slides: PlannedSlide[]
  omissions: { nodeId: string; reason: string }[]
}
