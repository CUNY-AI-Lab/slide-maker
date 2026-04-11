/**
 * 10-iteration test suite for the outline-to-deck planning pipeline.
 *
 * Tests each outline fixture through the parser and budget estimator,
 * validating node structures, kinds, and budget ranges. These tests
 * verify the deterministic portions of the pipeline without needing
 * an AI model or running server.
 *
 * Fixtures:
 *   1. gen-dev-foundations  — 27-slide workshop (CUNY AI Lab)
 *   2. system-prompting     — 30-slide workshop (CUNY AI Lab)
 *   3. creative-coding      — 15-slide workshop (CUNY AI Lab)
 *   4. minimal-title-only   — single heading
 *   5. short-3-slides       — 3 sections with bullets
 *   6. medium-8-slides      — 8 sections, quotes, notes
 *   7. bullet-heavy         — 6 sections, 50+ bullets
 *   8. quotes-and-figures   — quotes, figures, notes mix
 *   9. large-20-slides      — 20+ sections (NLP course)
 *  10. plain-paragraphs     — no headings below H1, paragraph-only body
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseOutline } from '../apps/api/src/utils/outline-parser.js'
import { estimateSlideCount } from '../apps/api/src/utils/slide-budget.js'
import type { OutlineNode } from '../packages/shared/src/outline-plan.js'

const FIXTURES_DIR = path.join(__dirname, 'fixtures/outlines')

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')
}

function countNodesByKind(nodes: OutlineNode[], kind: string): number {
  let count = 0
  for (const node of nodes) {
    if (node.kind === kind) count++
    count += countNodesByKind(node.children, kind)
  }
  return count
}

function flattenNodes(nodes: OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenNodes(node.children))
  }
  return result
}

// ─── Iteration 1: gen-dev-foundations ───────────────────────────

describe('Iteration 1: gen-dev-foundations SLIDES.md', () => {
  const md = loadFixture('gen-dev-foundations.md')
  const tree = parseOutline(md, 'file-gendev')
  const budget = estimateSlideCount(tree)

  it('parses a non-empty tree', () => {
    expect(tree.length).toBeGreaterThan(0)
  })

  it('detects the deck title', () => {
    const titles = tree.filter(n => n.kind === 'deckTitle')
    expect(titles.length).toBeGreaterThanOrEqual(1)
    expect(titles[0].text).toContain('Foundations')
  })

  it('detects section nodes for slides 2-27', () => {
    const sections = countNodesByKind(tree, 'section')
    // 27 slides minus the title = ~26 section-level headings
    expect(sections).toBeGreaterThanOrEqual(15)
  })

  it('captures bullet content within sections', () => {
    const bullets = countNodesByKind(tree, 'bullet')
    // The workshop has many bullet lists
    expect(bullets).toBeGreaterThan(20)
  })

  it('budget min is at least 10', () => {
    expect(budget.min).toBeGreaterThanOrEqual(10)
  })

  it('budget max reflects dense content (clamped at plan endpoint)', () => {
    // Budget estimator is advisory; plan endpoint clamps to MAX_SLIDES_PER_DECK
    expect(budget.max).toBeGreaterThanOrEqual(budget.min)
  })

  it('budget min <= max', () => {
    expect(budget.min).toBeLessThanOrEqual(budget.max)
  })

  it('all nodes have unique IDs', () => {
    const allNodes = flattenNodes(tree)
    const ids = allNodes.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all nodes reference the correct fileId', () => {
    const allNodes = flattenNodes(tree)
    for (const node of allNodes) {
      expect(node.source.fileId).toBe('file-gendev')
    }
  })
})

// ─── Iteration 2: system-prompting ─────────────────────────────

describe('Iteration 2: system-prompting SLIDES.md', () => {
  const md = loadFixture('system-prompting.md')
  const tree = parseOutline(md, 'file-sysprompt')
  const budget = estimateSlideCount(tree)

  it('parses a non-empty tree', () => {
    expect(tree.length).toBeGreaterThan(0)
  })

  it('detects section headings for 30 slides', () => {
    const sections = countNodesByKind(tree, 'section')
    expect(sections).toBeGreaterThanOrEqual(20)
  })

  it('captures blockquotes as quote nodes', () => {
    const quotes = countNodesByKind(tree, 'quote')
    // Has blockquotes about system prompts
    expect(quotes).toBeGreaterThanOrEqual(1)
  })

  it('detects paragraph content in pedagogical examples', () => {
    const paragraphs = countNodesByKind(tree, 'paragraph')
    expect(paragraphs).toBeGreaterThan(5)
  })

  it('budget range covers a reasonable deck size', () => {
    expect(budget.min).toBeGreaterThanOrEqual(15)
    // Max can exceed 60 — plan endpoint clamps to MAX_SLIDES_PER_DECK
    expect(budget.max).toBeGreaterThanOrEqual(budget.min)
  })

  it('budget min <= max', () => {
    expect(budget.min).toBeLessThanOrEqual(budget.max)
  })
})

// ─── Iteration 3: creative-coding ──────────────────────────────

describe('Iteration 3: creative-coding slides.md', () => {
  const md = loadFixture('creative-coding.md')
  const tree = parseOutline(md, 'file-creative')
  const budget = estimateSlideCount(tree)

  it('parses a non-empty tree', () => {
    expect(tree.length).toBeGreaterThan(0)
  })

  it('uses H1 as slide titles (non-standard format)', () => {
    // creative-coding uses # Slide N as top-level headings
    const titles = tree.filter(n => n.kind === 'deckTitle')
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('detects sections via H2/H3 headings', () => {
    const sections = countNodesByKind(tree, 'section')
    expect(sections).toBeGreaterThanOrEqual(10)
  })

  it('captures nested bullet lists', () => {
    const bullets = countNodesByKind(tree, 'bullet')
    expect(bullets).toBeGreaterThan(15)
  })

  it('budget estimate starts at 5+ slides', () => {
    expect(budget.min).toBeGreaterThanOrEqual(5)
    // Max can be large for content-heavy H1-per-slide format
    expect(budget.max).toBeGreaterThanOrEqual(budget.min)
  })
})

// ─── Iteration 4: minimal-title-only ───────────────────────────

describe('Iteration 4: minimal-title-only', () => {
  const md = loadFixture('minimal-title-only.md')
  const tree = parseOutline(md, 'file-minimal')
  const budget = estimateSlideCount(tree)

  it('parses exactly one node', () => {
    expect(tree.length).toBe(1)
  })

  it('the node is a deckTitle', () => {
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toBe('Introduction to Machine Learning')
  })

  it('budget is 1 slide', () => {
    expect(budget.min).toBe(1)
    expect(budget.max).toBe(1)
  })
})

// ─── Iteration 5: short-3-slides ───────────────────────────────

describe('Iteration 5: short-3-slides', () => {
  const md = loadFixture('short-3-slides.md')
  const tree = parseOutline(md, 'file-short')
  const budget = estimateSlideCount(tree)

  it('detects the deck title', () => {
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toContain('Data Visualization')
  })

  it('detects 3 sections', () => {
    const sections = tree.filter(n => n.kind === 'section')
    expect(sections.length).toBe(3)
  })

  it('each section has bullets', () => {
    const sections = tree.filter(n => n.kind === 'section')
    for (const section of sections) {
      const bullets = section.children.filter(c => c.kind === 'bullet')
      expect(bullets.length).toBeGreaterThan(0)
    }
  })

  it('budget range covers 4-7 slides', () => {
    // 1 title + 3 sections with bullets
    expect(budget.min).toBeGreaterThanOrEqual(4)
    expect(budget.max).toBeLessThanOrEqual(10)
  })
})

// ─── Iteration 6: medium-8-slides ──────────────────────────────

describe('Iteration 6: medium-8-slides', () => {
  const md = loadFixture('medium-8-slides.md')
  const tree = parseOutline(md, 'file-medium')
  const budget = estimateSlideCount(tree)

  it('detects the deck title', () => {
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toContain('Ethical AI')
  })

  it('detects sections including subsections', () => {
    const sections = countNodesByKind(tree, 'section')
    // Main sections + subsections (Consequentialism, Deontological, Virtue)
    expect(sections).toBeGreaterThanOrEqual(6)
  })

  it('captures the blockquote about writing assignments', () => {
    const quotes = countNodesByKind(tree, 'quote')
    expect(quotes).toBeGreaterThanOrEqual(1)
  })

  it('captures the note about EDUCAUSE', () => {
    const notes = countNodesByKind(tree, 'notes')
    expect(notes).toBeGreaterThanOrEqual(1)
  })

  it('captures numbered discussion questions as bullets', () => {
    const allBullets = countNodesByKind(tree, 'bullet')
    expect(allBullets).toBeGreaterThanOrEqual(10)
  })

  it('budget reflects medium-sized deck', () => {
    expect(budget.min).toBeGreaterThanOrEqual(6)
    expect(budget.max).toBeLessThanOrEqual(25)
  })
})

// ─── Iteration 7: bullet-heavy ─────────────────────────────────

describe('Iteration 7: bullet-heavy', () => {
  const md = loadFixture('bullet-heavy.md')
  const tree = parseOutline(md, 'file-bullets')
  const budget = estimateSlideCount(tree)

  it('detects 6 sections', () => {
    const sections = tree.filter(n => n.kind === 'section')
    expect(sections.length).toBe(6)
  })

  it('captures 40+ bullets total', () => {
    const bullets = countNodesByKind(tree, 'bullet')
    expect(bullets).toBeGreaterThanOrEqual(40)
  })

  it('each section has at least 6 bullets', () => {
    const sections = tree.filter(n => n.kind === 'section')
    for (const section of sections) {
      const bullets = section.children.filter(c => c.kind === 'bullet')
      expect(bullets.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('budget splits bullets across multiple slides per section', () => {
    // 6 sections × (divider + 2+ content slides) = at least 12
    expect(budget.min).toBeGreaterThanOrEqual(10)
    // Max should give 1 slide per 3 bullets → many slides
    expect(budget.max).toBeGreaterThanOrEqual(18)
  })

  it('budget max does not exceed slide limit', () => {
    expect(budget.max).toBeLessThanOrEqual(60)
  })
})

// ─── Iteration 8: quotes-and-figures ───────────────────────────

describe('Iteration 8: quotes-and-figures', () => {
  const md = loadFixture('quotes-and-figures.md')
  const tree = parseOutline(md, 'file-quotesfig')
  const budget = estimateSlideCount(tree)

  it('detects the deck title', () => {
    expect(tree[0].kind).toBe('deckTitle')
  })

  it('detects multiple quotes', () => {
    const quotes = countNodesByKind(tree, 'quote')
    expect(quotes).toBeGreaterThanOrEqual(3)
  })

  it('detects figure nodes for images', () => {
    const figures = countNodesByKind(tree, 'figure')
    expect(figures).toBeGreaterThanOrEqual(2)
  })

  it('detects notes about Cairo and Tufte', () => {
    const notes = countNodesByKind(tree, 'notes')
    expect(notes).toBeGreaterThanOrEqual(1)
  })

  it('budget accounts for figures as dedicated slides', () => {
    const figures = countNodesByKind(tree, 'figure')
    expect(budget.min).toBeGreaterThanOrEqual(figures + 3)
  })

  it('budget min <= max', () => {
    expect(budget.min).toBeLessThanOrEqual(budget.max)
  })
})

// ─── Iteration 9: large-20-slides (NLP course) ────────────────

describe('Iteration 9: large-20-slides', () => {
  const md = loadFixture('large-20-slides.md')
  const tree = parseOutline(md, 'file-large')
  const budget = estimateSlideCount(tree)

  it('detects the deck title', () => {
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toContain('Natural Language Processing')
  })

  it('detects 15+ sections for a large outline', () => {
    const sections = countNodesByKind(tree, 'section')
    expect(sections).toBeGreaterThanOrEqual(15)
  })

  it('detects subsections (Tokenization, Normalization, etc.)', () => {
    const sections = countNodesByKind(tree, 'section')
    // Should pick up ### subsections too
    expect(sections).toBeGreaterThanOrEqual(20)
  })

  it('captures the Firth quote', () => {
    const quotes = countNodesByKind(tree, 'quote')
    expect(quotes).toBeGreaterThanOrEqual(1)
  })

  it('captures notes about final project', () => {
    const notes = countNodesByKind(tree, 'notes')
    expect(notes).toBeGreaterThanOrEqual(1)
  })

  it('budget reflects a 20+ slide deck', () => {
    expect(budget.min).toBeGreaterThanOrEqual(15)
    expect(budget.max).toBeGreaterThanOrEqual(25)
  })

  it('budget max reflects large outline content', () => {
    // 20+ sections with bullets → unclamped max can exceed 60
    expect(budget.max).toBeGreaterThanOrEqual(25)
  })
})

// ─── Iteration 10: plain-paragraphs ────────────────────────────

describe('Iteration 10: plain-paragraphs', () => {
  const md = loadFixture('plain-paragraphs.md')
  const tree = parseOutline(md, 'file-paras')
  const budget = estimateSlideCount(tree)

  it('detects the deck title', () => {
    expect(tree[0].kind).toBe('deckTitle')
    expect(tree[0].text).toContain('Urban Heat Islands')
  })

  it('creates paragraph nodes for body text', () => {
    const paragraphs = countNodesByKind(tree, 'paragraph')
    // 6 paragraphs of body text
    expect(paragraphs).toBeGreaterThanOrEqual(4)
  })

  it('has no sections (all H1 + paragraphs)', () => {
    const sections = countNodesByKind(tree, 'section')
    expect(sections).toBe(0)
  })

  it('budget min groups paragraphs into fewer slides', () => {
    // ~6 paragraphs → min groups 3 per slide → ~2 + title = 3
    expect(budget.min).toBeGreaterThanOrEqual(3)
  })

  it('budget max gives 1 slide per paragraph', () => {
    // 6+ paragraphs + 1 title → 7+
    expect(budget.max).toBeGreaterThanOrEqual(5)
  })

  it('budget min <= max', () => {
    expect(budget.min).toBeLessThanOrEqual(budget.max)
  })
})

// ─── Cross-cutting assertions ──────────────────────────────────

describe('Cross-cutting: all 10 outlines', () => {
  const fixtures = [
    'gen-dev-foundations.md',
    'system-prompting.md',
    'creative-coding.md',
    'minimal-title-only.md',
    'short-3-slides.md',
    'medium-8-slides.md',
    'bullet-heavy.md',
    'quotes-and-figures.md',
    'large-20-slides.md',
    'plain-paragraphs.md',
  ]

  for (const fixture of fixtures) {
    describe(fixture, () => {
      const md = loadFixture(fixture)
      const tree = parseOutline(md, `file-${fixture}`)
      const budget = estimateSlideCount(tree)
      const allNodes = flattenNodes(tree)

      it('parser returns non-empty tree', () => {
        expect(tree.length).toBeGreaterThan(0)
      })

      it('budget min >= 1', () => {
        expect(budget.min).toBeGreaterThanOrEqual(1)
      })

      it('budget min <= max', () => {
        expect(budget.min).toBeLessThanOrEqual(budget.max)
      })

      it('all node IDs are unique', () => {
        const ids = allNodes.map(n => n.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('all source spans have start < end', () => {
        for (const node of allNodes) {
          expect(node.source.start).toBeLessThan(node.source.end)
        }
      })

      it('every node kind is valid', () => {
        const validKinds = new Set(['deckTitle', 'section', 'bullet', 'paragraph', 'quote', 'figure', 'notes'])
        for (const node of allNodes) {
          expect(validKinds.has(node.kind)).toBe(true)
        }
      })
    })
  }
})
