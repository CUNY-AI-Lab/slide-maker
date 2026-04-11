import type { OutlineNode } from '@slide-maker/shared'

const BULLETS_PER_SLIDE_MIN = 3
const BULLETS_PER_SLIDE_MAX = 5

/**
 * Estimate a slide count range from a parsed outline tree.
 *
 * Rules:
 * - deckTitle → 1 title slide
 * - section → 1 divider slide + content slides for children
 * - 3-5 bullets = 1 content slide; overflow splits
 * - standalone quote → 1 quote slide
 * - figure → 1 visual slide
 * - paragraphs → 1 content slide per ~3 paragraphs (min), 1 per paragraph (max)
 * - closing section or notes → 1 closing slide
 *
 * Returns { min, max } where min assumes aggressive merging and max assumes one-to-one mapping.
 * The estimate is advisory — shown to the user with a slider, not a hard constraint.
 */
export function estimateSlideCount(tree: OutlineNode[]): { min: number; max: number } {
  if (!tree.length) return { min: 1, max: 1 }

  let min = 0
  let max = 0

  for (const node of tree) {
    const { min: nodeMin, max: nodeMax } = estimateNode(node)
    min += nodeMin
    max += nodeMax
  }

  // At minimum, always produce at least 1 slide
  return { min: Math.max(1, min), max: Math.max(1, max) }
}

function estimateNode(node: OutlineNode): { min: number; max: number } {
  switch (node.kind) {
    case 'deckTitle':
      return { min: 1, max: 1 }

    case 'section':
      return estimateSection(node)

    case 'bullet':
      // Top-level bullet (no parent section) → 1 slide
      return { min: 1, max: 1 }

    case 'paragraph':
      return { min: 1, max: 1 }

    case 'quote':
      return { min: 1, max: 1 }

    case 'figure':
      return { min: 1, max: 1 }

    case 'notes':
      // Notes can fold into a closing slide (min) or be a separate slide (max)
      return { min: 0, max: 1 }

    default:
      return { min: 1, max: 1 }
  }
}

function estimateSection(section: OutlineNode): { min: number; max: number } {
  const children = section.children
  if (!children.length) {
    // Empty section → just a divider
    return { min: 1, max: 1 }
  }

  // The section header itself produces a divider slide
  let min = 1
  let max = 1

  // Group children by type for estimation
  let bulletCount = 0
  let paragraphCount = 0
  let quoteCount = 0
  let figureCount = 0
  let noteCount = 0

  for (const child of children) {
    switch (child.kind) {
      case 'bullet':
        bulletCount++
        break
      case 'paragraph':
        paragraphCount++
        break
      case 'quote':
        quoteCount++
        break
      case 'figure':
        figureCount++
        break
      case 'notes':
        noteCount++
        break
      default:
        paragraphCount++
        break
    }
  }

  // Bullet slides: min packs BULLETS_PER_SLIDE_MAX per slide, max packs BULLETS_PER_SLIDE_MIN
  if (bulletCount > 0) {
    min += Math.ceil(bulletCount / BULLETS_PER_SLIDE_MAX)
    max += Math.ceil(bulletCount / BULLETS_PER_SLIDE_MIN)
  }

  // Paragraph slides: min groups ~3 paragraphs per slide, max is 1 per paragraph
  if (paragraphCount > 0) {
    min += Math.ceil(paragraphCount / 3)
    max += paragraphCount
  }

  // Quotes: min folds into content slide, max gets dedicated slide each
  if (quoteCount > 0) {
    min += Math.ceil(quoteCount / 2) // pair quotes conservatively
    max += quoteCount
  }

  // Figures: each gets a visual slide
  if (figureCount > 0) {
    min += figureCount
    max += figureCount
  }

  // Notes: fold into existing slides (min) or separate (max)
  if (noteCount > 0) {
    max += noteCount
  }

  return { min, max }
}
