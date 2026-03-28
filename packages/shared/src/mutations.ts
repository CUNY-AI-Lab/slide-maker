import type { BlockType, SlideType } from './block-types.js'

export type Mutation =
  | { action: 'addSlide'; payload: AddSlidePayload }
  | { action: 'removeSlide'; payload: { slideId: string } }
  | { action: 'updateBlock'; payload: { slideId: string; blockId: string; data: Record<string, unknown> } }
  | { action: 'addBlock'; payload: { slideId: string; block: { type: BlockType; data: Record<string, unknown> }; insertAfter?: string } }
  | { action: 'removeBlock'; payload: { slideId: string; blockId: string } }
  | { action: 'reorderSlides'; payload: { order: string[] } }
  | { action: 'reorderBlocks'; payload: { slideId: string; order: string[] } }
  | { action: 'applyTemplate'; payload: { slideId: string; templateId: string } }
  | { action: 'setTheme'; payload: { themeId: string } }
  | { action: 'updateMetadata'; payload: { field: string; value: string } }

export interface AddSlidePayload {
  type: SlideType
  blocks: { type: BlockType; data: Record<string, unknown> }[]
  insertAfter?: string
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'mutation'; mutation: Mutation }
  | { type: 'error'; message: string }
  | { type: 'done' }
