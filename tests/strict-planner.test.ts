/**
 * Verifies that the deterministic strict planner preserves every outline
 * node's text verbatim. Strict fidelity cannot paraphrase or omit — every
 * node.text must appear byte-identical in a slide module's data field or
 * the slide's notes.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseOutline } from '../apps/api/src/utils/outline-parser.js'
import { estimateSlideCount } from '../apps/api/src/utils/slide-budget.js'
import { buildStrictPlan, buildStrictDeckPlan } from '../apps/api/src/utils/strict-planner.js'
import type { OutlineNode, PlannedSlide } from '../packages/shared/src/outline-plan.js'
import { LAYOUT_ZONES, MODULE_TYPES } from '../packages/shared/src/block-types.js'

const FIXTURES_DIR = path.join(__dirname, 'fixtures/outlines')

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')
}

function flattenNodes(nodes: OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenNodes(node.children))
  }
  return result
}

function harvestTextFromSlides(slides: PlannedSlide[]): string {
  const chunks: string[] = []
  for (const slide of slides) {
    if (slide.title) chunks.push(slide.title)
    if (slide.notes) chunks.push(slide.notes)
    for (const mod of slide.modules) {
      const d = mod.data as Record<string, unknown>
      for (const key of ['text', 'markdown', 'content', 'alt', 'body']) {
        const v = d[key]
        if (typeof v === 'string') chunks.push(v)
      }
      if (Array.isArray(d.items)) {
        for (const item of d.items) {
          if (typeof item === 'string') chunks.push(item)
        }
      }
    }
  }
  return chunks.join('\n')
}

const FIXTURES = [
  'minimal-title-only.md',
  'short-3-slides.md',
  'medium-8-slides.md',
  'bullet-heavy.md',
  'quotes-and-figures.md',
  'plain-paragraphs.md',
]

describe('strict-planner: verbatim preservation', () => {
  for (const fixture of FIXTURES) {
    describe(fixture, () => {
      const md = loadFixture(fixture)
      const tree = parseOutline(md, `strict-${fixture}`)
      const { slides, omissions } = buildStrictPlan(tree)
      const harvested = harvestTextFromSlides(slides)
      const allNodes = flattenNodes(tree)

      it('produces at least one slide', () => {
        expect(slides.length).toBeGreaterThan(0)
      })

      it('never omits anything', () => {
        expect(omissions).toEqual([])
      })

      it('every node.text appears verbatim somewhere in the slides', () => {
        for (const node of allNodes) {
          // The parser can produce multi-line text (e.g., multi-line quotes
          // joined by "\n"); those match after collapsing our chunk join.
          expect(harvested).toContain(node.text)
        }
      })

      it('every slide layout is a known value', () => {
        const valid = new Set(Object.keys(LAYOUT_ZONES))
        for (const s of slides) {
          expect(valid.has(s.layout)).toBe(true)
        }
      })

      it('every module zone is valid for its slide layout', () => {
        for (const s of slides) {
          const zones = LAYOUT_ZONES[s.layout]
          for (const m of s.modules) {
            expect(zones).toContain(m.zone)
          }
        }
      })

      it('every module type is a known module type', () => {
        const valid = new Set<string>(MODULE_TYPES)
        for (const s of slides) {
          for (const m of s.modules) {
            expect(valid.has(m.type)).toBe(true)
          }
        }
      })

      it('every slide declares strict fidelity', () => {
        for (const s of slides) {
          expect(s.fidelity).toBe('strict')
        }
      })

      it('every slide has a planId and sourceNodeIds array', () => {
        for (const s of slides) {
          expect(typeof s.planId).toBe('string')
          expect(s.planId.length).toBeGreaterThan(0)
          expect(Array.isArray(s.sourceNodeIds)).toBe(true)
        }
      })

      it('every outline node ID is covered by some slide or module sourceNodeIds', () => {
        const covered = new Set<string>()
        for (const s of slides) {
          s.sourceNodeIds.forEach((id) => covered.add(id))
          for (const m of s.modules) {
            if (Array.isArray(m.sourceNodeIds)) {
              m.sourceNodeIds.forEach((id) => covered.add(id))
            }
          }
        }
        for (const node of allNodes) {
          expect(covered.has(node.id)).toBe(true)
        }
      })
    })
  }
})

describe('strict-planner: determinism', () => {
  it('produces the same layout/module/content shape on repeated runs', () => {
    const md = loadFixture('medium-8-slides.md')
    const tree1 = parseOutline(md, 'det-run-1')
    const tree2 = parseOutline(md, 'det-run-2')
    const plan1 = buildStrictPlan(tree1)
    const plan2 = buildStrictPlan(tree2)

    expect(plan1.slides.length).toBe(plan2.slides.length)
    for (let i = 0; i < plan1.slides.length; i++) {
      const a = plan1.slides[i]
      const b = plan2.slides[i]
      expect(a.layout).toBe(b.layout)
      expect(a.purpose).toBe(b.purpose)
      expect(a.title).toBe(b.title)
      expect(a.notes ?? null).toBe(b.notes ?? null)
      expect(a.modules.length).toBe(b.modules.length)
      for (let j = 0; j < a.modules.length; j++) {
        expect(a.modules[j].type).toBe(b.modules[j].type)
        expect(a.modules[j].zone).toBe(b.modules[j].zone)
        expect(a.modules[j].data).toEqual(b.modules[j].data)
      }
    }
  })
})

describe('strict-planner: deck plan wrapper', () => {
  it('buildStrictDeckPlan returns a full DeckPlan with fidelity=strict', () => {
    const md = loadFixture('short-3-slides.md')
    const tree = parseOutline(md, 'wrapper-test')
    const budget = estimateSlideCount(tree)
    const plan = buildStrictDeckPlan(tree, budget)

    expect(plan.fidelity).toBe('strict')
    expect(plan.outlineTree).toBe(tree)
    expect(plan.estimatedSlideCount).toEqual(budget)
    expect(plan.slides.length).toBeGreaterThan(0)
    expect(plan.omissions).toEqual([])
  })
})

describe('strict-planner: specific packing rules', () => {
  it('packs ≤5 bullets per stream-list slide', () => {
    const md = loadFixture('bullet-heavy.md')
    const tree = parseOutline(md, 'pack-test')
    const { slides } = buildStrictPlan(tree)
    for (const s of slides) {
      for (const m of s.modules) {
        if (m.type === 'stream-list') {
          const items = (m.data as Record<string, unknown>).items as unknown[]
          expect(items.length).toBeLessThanOrEqual(5)
          expect(items.length).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('emits a title-slide when the outline has a deckTitle', () => {
    const md = loadFixture('short-3-slides.md')
    const tree = parseOutline(md, 'title-test')
    const { slides } = buildStrictPlan(tree)
    expect(slides[0].layout).toBe('title-slide')
    expect(slides[0].purpose).toBe('title')
  })

  it('emits a divider before each section', () => {
    const md = loadFixture('short-3-slides.md')
    const tree = parseOutline(md, 'divider-test')
    const { slides } = buildStrictPlan(tree)
    const dividers = slides.filter((s) => s.layout === 'layout-divider')
    const sections = tree.filter((n) => n.kind === 'section')
    // Every non-closing section produces a divider slide; short-3-slides has
    // no "closing"/"thank you" sections so all three map 1:1.
    expect(dividers.length).toBe(sections.length)
  })

  it('places figures into layout-content with image placeholders', () => {
    const md = loadFixture('quotes-and-figures.md')
    const tree = parseOutline(md, 'figure-test')
    const { slides } = buildStrictPlan(tree)
    const figures = slides.filter((s) => s.purpose === 'visual')
    expect(figures.length).toBeGreaterThan(0)
    for (const s of figures) {
      expect(s.layout).toBe('layout-content')
      const image = s.modules.find((m) => m.type === 'image')
      expect(image).toBeDefined()
      expect((image!.data as Record<string, unknown>).src).toBe('placeholder')
    }
  })

  it('places quotes in tip-box modules', () => {
    const md = loadFixture('quotes-and-figures.md')
    const tree = parseOutline(md, 'quote-test')
    const { slides } = buildStrictPlan(tree)
    const quoteSlides = slides.filter((s) => s.purpose === 'quote')
    expect(quoteSlides.length).toBeGreaterThan(0)
    for (const s of quoteSlides) {
      const tip = s.modules.find((m) => m.type === 'tip-box')
      expect(tip).toBeDefined()
    }
  })
})
