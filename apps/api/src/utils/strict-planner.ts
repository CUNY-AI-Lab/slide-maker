import { createId } from '@paralleldrive/cuid2'
import type {
  OutlineNode,
  PlannedSlide,
  PlannedModule,
  DeckPlan,
} from '@slide-maker/shared'

const BULLETS_PER_SLIDE_MAX = 5
const TITLE_MAX_LEN = 80

const CLOSING_PATTERNS = [
  /^thank(s| you)/i,
  /^closing/i,
  /^conclusion/i,
  /^wrap[-_ ]?up/i,
  /^q\s*&\s*a/i,
  /^q\s+and\s+a/i,
]

function isClosingSection(node: OutlineNode): boolean {
  return node.kind === 'section' && CLOSING_PATTERNS.some((re) => re.test(node.text.trim()))
}

function truncateTitle(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_MAX_LEN ? flat.slice(0, TITLE_MAX_LEN - 1) + '…' : flat
}

type DraftSlide = Omit<PlannedSlide, 'planId'>

function emitTitleSlide(node: OutlineNode): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'title',
    layout: 'title-slide',
    title: node.text,
    fidelity: 'strict',
    modules: [
      {
        type: 'heading',
        zone: 'hero',
        data: { text: node.text, level: 1 },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function emitDividerSlide(node: OutlineNode): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'divider',
    layout: 'layout-divider',
    title: node.text,
    fidelity: 'strict',
    modules: [
      {
        type: 'heading',
        zone: 'hero',
        data: { text: node.text, level: 2 },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function emitClosingSlide(node: OutlineNode): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'closing',
    layout: 'closing-slide',
    title: node.text,
    fidelity: 'strict',
    modules: [
      {
        type: 'heading',
        zone: 'hero',
        data: { text: node.text, level: 2 },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function emitBulletSlide(chunk: OutlineNode[], sectionTitle: string): DraftSlide {
  return {
    sourceNodeIds: chunk.map((c) => c.id),
    purpose: 'content',
    layout: 'layout-content',
    title: truncateTitle(sectionTitle || chunk[0].text),
    fidelity: 'strict',
    modules: [
      {
        type: 'stream-list',
        zone: 'main',
        data: { items: chunk.map((c) => c.text) },
        sourceNodeIds: chunk.map((c) => c.id),
      },
    ],
  }
}

function emitParagraphSlide(node: OutlineNode, sectionTitle: string): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'content',
    layout: 'layout-content',
    title: truncateTitle(sectionTitle || node.text),
    fidelity: 'strict',
    modules: [
      {
        type: 'text',
        zone: 'main',
        data: { markdown: node.text },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function emitQuoteSlide(node: OutlineNode, sectionTitle: string): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'quote',
    layout: 'layout-content',
    title: truncateTitle(sectionTitle || 'Quote'),
    fidelity: 'strict',
    modules: [
      {
        type: 'tip-box',
        zone: 'main',
        data: { content: node.text },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function emitFigureSlide(node: OutlineNode, sectionTitle: string): DraftSlide {
  return {
    sourceNodeIds: [node.id],
    purpose: 'visual',
    layout: 'layout-content',
    title: truncateTitle(sectionTitle || node.text || 'Figure'),
    fidelity: 'strict',
    modules: [
      {
        type: 'image',
        zone: 'main',
        data: { src: 'placeholder', alt: node.text || '' },
        sourceNodeIds: [node.id],
      },
    ],
  }
}

function packChildren(children: OutlineNode[], sectionTitle: string): {
  slides: DraftSlide[]
  leftoverNotes: OutlineNode[]
} {
  const slides: DraftSlide[] = []
  let bulletGroup: OutlineNode[] = []
  const leftoverNotes: OutlineNode[] = []

  const flushBullets = () => {
    if (!bulletGroup.length) return
    for (let i = 0; i < bulletGroup.length; i += BULLETS_PER_SLIDE_MAX) {
      const chunk = bulletGroup.slice(i, i + BULLETS_PER_SLIDE_MAX)
      slides.push(emitBulletSlide(chunk, sectionTitle))
    }
    bulletGroup = []
  }

  const attachNoteToLast = (note: OutlineNode) => {
    if (!slides.length) {
      leftoverNotes.push(note)
      return
    }
    const last = slides[slides.length - 1]
    last.notes = (last.notes ? last.notes + '\n' : '') + note.text
    last.sourceNodeIds.push(note.id)
  }

  for (const child of children) {
    switch (child.kind) {
      case 'bullet':
        bulletGroup.push(child)
        break
      case 'notes':
        flushBullets()
        attachNoteToLast(child)
        break
      case 'paragraph':
        flushBullets()
        slides.push(emitParagraphSlide(child, sectionTitle))
        break
      case 'quote':
        flushBullets()
        slides.push(emitQuoteSlide(child, sectionTitle))
        break
      case 'figure':
        flushBullets()
        slides.push(emitFigureSlide(child, sectionTitle))
        break
      case 'deckTitle':
      case 'section':
        // These shouldn't appear as children in the current parser;
        // if they do, treat as paragraph to avoid data loss.
        flushBullets()
        slides.push(emitParagraphSlide(child, sectionTitle))
        break
    }
  }

  flushBullets()
  return { slides, leftoverNotes }
}

/**
 * Deterministically map an outline tree to a DeckPlan with strict verbatim
 * fidelity. Every outline node's text lands in a module's data field or the
 * slide's notes, and nothing is paraphrased.
 *
 * Packing rules:
 * - deckTitle        → title-slide (heading level 1, hero zone)
 * - section          → layout-divider (heading level 2) + content slides for children
 *   · bullets         → layout-content with stream-list (≤5 per slide, source order)
 *   · paragraph       → layout-content with text(markdown)
 *   · quote           → layout-content with tip-box
 *   · figure          → layout-content with image(src:"placeholder", alt)
 *   · notes           → appended to the notes field of the preceding slide
 * - Sections matching "thank you"/"closing"/"conclusion"/"wrap-up"/"Q&A"
 *   → closing-slide (and their children still get packed afterward)
 */
export function buildStrictPlan(tree: OutlineNode[]): {
  slides: PlannedSlide[]
  omissions: never[]
} {
  const drafts: DraftSlide[] = []

  for (const node of tree) {
    if (node.kind === 'deckTitle') {
      drafts.push(emitTitleSlide(node))
      continue
    }

    if (node.kind === 'section') {
      const closing = isClosingSection(node)
      const headerSlide = closing ? emitClosingSlide(node) : emitDividerSlide(node)
      drafts.push(headerSlide)

      const { slides: childSlides, leftoverNotes } = packChildren(
        node.children,
        node.text,
      )
      // Leftover notes (notes with no preceding content slide in the section)
      // attach to the header slide so nothing is lost.
      for (const note of leftoverNotes) {
        headerSlide.notes = (headerSlide.notes ? headerSlide.notes + '\n' : '') + note.text
        headerSlide.sourceNodeIds.push(note.id)
      }
      for (const s of childSlides) drafts.push(s)
      continue
    }

    // Top-level non-title, non-section node (rare — outline without sections).
    // Pack it using the same rules as section children.
    const { slides: childSlides, leftoverNotes } = packChildren([node], '')
    for (const s of childSlides) drafts.push(s)
    // If a note has nowhere to land, emit a one-off text slide so it survives.
    for (const note of leftoverNotes) {
      drafts.push(emitParagraphSlide(note, ''))
    }
  }

  const slides: PlannedSlide[] = drafts.map((d) => ({ planId: createId(), ...d }))
  return { slides, omissions: [] }
}

/**
 * Full DeckPlan wrapper. Mirrors what the LLM planner returns so plan.ts can
 * use it interchangeably.
 */
export function buildStrictDeckPlan(
  tree: OutlineNode[],
  estimatedSlideCount: { min: number; max: number },
): DeckPlan {
  const { slides, omissions } = buildStrictPlan(tree)
  return {
    outlineTree: tree,
    estimatedSlideCount,
    fidelity: 'strict',
    slides,
    omissions,
  }
}
