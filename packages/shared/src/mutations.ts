import type { SlideLayout, ModuleType, Zone } from './block-types.js'

export type Mutation =
  | { action: 'addSlide'; payload: AddSlidePayload }
  | { action: 'removeSlide'; payload: { slideId: string } }
  | { action: 'updateBlock'; payload: { slideId: string; blockId: string; data: Record<string, unknown> } }
  | { action: 'addBlock'; payload: { slideId: string; block: { type: ModuleType; zone: Zone; data: Record<string, unknown>; stepOrder?: number }; insertAfter?: string } }
  | { action: 'removeBlock'; payload: { slideId: string; blockId: string } }
  | { action: 'reorderSlides'; payload: { order: string[] } }
  | { action: 'reorderBlocks'; payload: { slideId: string; zone: string; order: string[] } }
  | { action: 'moveBlockToZone'; payload: { slideId: string; blockId: string; fromZone: string; toZone: string; order: string[] } }
  | { action: 'moveBlockToSlide'; payload: { fromSlideId: string; toSlideId: string; blockId: string; toZone: Zone; toIndex?: number } }
  | { action: 'applyTemplate'; payload: { slideId?: string; templateId: string } }
  | { action: 'updateSlide'; payload: { slideId: string; layout?: SlideLayout; splitRatio?: string; notes?: string } }
  | { action: 'setTheme'; payload: { themeId: string } }
  | { action: 'updateMetadata'; payload: { name?: string } }
  | { action: 'updateArtifactConfig'; payload: { artifactName: string; config: Record<string, unknown> } }
  | { action: 'searchImage'; payload: { query: string; slideId: string; zone: Zone; alt: string; blockId?: string } }

export interface AddSlidePayload {
  layout: SlideLayout
  modules: { type: ModuleType; zone: Zone; data: Record<string, unknown>; stepOrder?: number }[]
  insertAfter?: string
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'mutation'; mutation: Mutation }
  | { type: 'error'; message: string }
  | { type: 'done' }
