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
  | { action: 'applyTemplate'; payload: { slideId?: string; templateId: string } }
  | { action: 'setTheme'; payload: { themeId: string } }
  | { action: 'updateMetadata'; payload: { name?: string } }
  | { action: 'updateArtifactConfig'; payload: { artifactName: string; config: Record<string, unknown> } }

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
