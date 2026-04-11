import { describe, it, expect } from 'vitest'
import { estimateSlideCount } from '../apps/api/src/utils/slide-budget'
import type { OutlineNode } from '../packages/shared/src/outline-plan'

function node(kind: OutlineNode['kind'], text: string, children: OutlineNode[] = []): OutlineNode {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
    children,
    source: { fileId: 'test', start: 0, end: text.length },
  }
}

describe('slide-budget', () => {
  it('returns { min: 1, max: 1 } for empty tree', () => {
    expect(estimateSlideCount([])).toEqual({ min: 1, max: 1 })
  })

  it('title-only outline produces exactly 1 slide', () => {
    const tree = [node('deckTitle', 'My Deck')]
    expect(estimateSlideCount(tree)).toEqual({ min: 1, max: 1 })
  })

  it('empty section produces 1 divider slide', () => {
    const tree = [node('section', 'Intro')]
    const result = estimateSlideCount(tree)
    expect(result.min).toBe(1)
    expect(result.max).toBe(1)
  })

  it('section with 3 bullets produces divider + 1 content slide', () => {
    const tree = [
      node('section', 'Points', [
        node('bullet', 'A'),
        node('bullet', 'B'),
        node('bullet', 'C'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    // min: 1 divider + ceil(3/5) = 1+1 = 2
    // max: 1 divider + ceil(3/3) = 1+1 = 2
    expect(result.min).toBe(2)
    expect(result.max).toBe(2)
  })

  it('section with 15 bullets splits into multiple content slides', () => {
    const bullets = Array.from({ length: 15 }, (_, i) => node('bullet', `Point ${i + 1}`))
    const tree = [node('section', 'Many Points', bullets)]
    const result = estimateSlideCount(tree)
    // min: 1 divider + ceil(15/5) = 1+3 = 4
    // max: 1 divider + ceil(15/3) = 1+5 = 6
    expect(result.min).toBe(4)
    expect(result.max).toBe(6)
  })

  it('5-section outline estimates a reasonable range', () => {
    const tree = [
      node('deckTitle', 'Title'),
      node('section', 'Section 1', [
        node('bullet', 'A'),
        node('bullet', 'B'),
        node('paragraph', 'Some text'),
      ]),
      node('section', 'Section 2', [
        node('bullet', 'C'),
        node('bullet', 'D'),
        node('bullet', 'E'),
        node('bullet', 'F'),
      ]),
      node('section', 'Section 3', [
        node('quote', 'Famous quote'),
        node('figure', 'Chart'),
      ]),
      node('section', 'Section 4', [
        node('paragraph', 'Conclusion text'),
        node('notes', 'Speaker notes'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    // Should be in a reasonable range for a ~15-slide deck
    expect(result.min).toBeGreaterThanOrEqual(7)
    expect(result.max).toBeLessThanOrEqual(15)
    expect(result.min).toBeLessThanOrEqual(result.max)
  })

  it('figures always count as 1 slide each', () => {
    const tree = [
      node('section', 'Gallery', [
        node('figure', 'Photo 1'),
        node('figure', 'Photo 2'),
        node('figure', 'Photo 3'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    // min: 1 divider + 3 figures = 4
    // max: 1 divider + 3 figures = 4
    expect(result.min).toBe(4)
    expect(result.max).toBe(4)
  })

  it('notes fold into min but expand in max', () => {
    const tree = [
      node('section', 'Closing', [
        node('paragraph', 'Summary'),
        node('notes', 'Remember to mention X'),
        node('notes', 'Also mention Y'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    // min: 1 divider + 1 para + 0 notes = 2
    // max: 1 divider + 1 para + 2 notes = 4
    expect(result.min).toBe(2)
    expect(result.max).toBe(4)
  })

  it('top-level bullets without a section each count as 1', () => {
    const tree = [
      node('bullet', 'Loose point 1'),
      node('bullet', 'Loose point 2'),
    ]
    const result = estimateSlideCount(tree)
    expect(result.min).toBe(2)
    expect(result.max).toBe(2)
  })

  it('quotes: min pairs them, max gives each a slide', () => {
    const tree = [
      node('section', 'Quotes', [
        node('quote', 'Quote A'),
        node('quote', 'Quote B'),
        node('quote', 'Quote C'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    // min: 1 divider + ceil(3/2) = 1+2 = 3
    // max: 1 divider + 3 = 4
    expect(result.min).toBe(3)
    expect(result.max).toBe(4)
  })

  it('min is always <= max', () => {
    const tree = [
      node('deckTitle', 'Talk'),
      node('section', 'A', [
        node('bullet', '1'), node('bullet', '2'), node('bullet', '3'),
        node('bullet', '4'), node('bullet', '5'), node('bullet', '6'),
        node('paragraph', 'Text'),
        node('quote', 'Q'),
        node('figure', 'F'),
        node('notes', 'N'),
      ]),
      node('section', 'B', [
        node('paragraph', 'P1'),
        node('paragraph', 'P2'),
        node('paragraph', 'P3'),
        node('paragraph', 'P4'),
      ]),
    ]
    const result = estimateSlideCount(tree)
    expect(result.min).toBeLessThanOrEqual(result.max)
  })
})
