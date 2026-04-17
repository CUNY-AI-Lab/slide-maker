/**
 * Verifies the chat system prompt gains a "Fidelity Contract: STRICT"
 * section and [strict-locked] markers only when the deck is strict-mode.
 */

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../apps/api/src/prompts/system.js'

function flatten(opts: Parameters<typeof buildSystemPrompt>[0]): string {
  const { staticPrompt, dynamicContext } = buildSystemPrompt(opts)
  return `${staticPrompt}\n\n${dynamicContext}`
}

function makeDeck(strictBlockIds: string[] = []) {
  const blocks = [
    {
      id: 'block-free',
      slideId: 'slide-1',
      type: 'heading',
      zone: 'hero',
      data: { text: 'Free Title', level: 1 },
      order: 0,
      stepOrder: null,
      sourceNodeIds: null,
    },
    {
      id: 'block-locked',
      slideId: 'slide-1',
      type: 'text',
      zone: 'main',
      data: { markdown: 'Verbatim paragraph from outline.' },
      order: 1,
      stepOrder: null,
      sourceNodeIds: strictBlockIds.includes('block-locked') ? ['node-a', 'node-b'] : null,
    },
    {
      id: 'block-free-2',
      slideId: 'slide-1',
      type: 'text',
      zone: 'main',
      data: { markdown: 'Commentary added after import.' },
      order: 2,
      stepOrder: null,
      sourceNodeIds: null,
    },
  ]

  return {
    id: 'deck-1',
    name: 'Test Deck',
    themeId: null,
    slides: [
      {
        id: 'slide-1',
        deckId: 'deck-1',
        layout: 'layout-content',
        order: 0,
        notes: null,
        blocks,
      },
    ],
  }
}

describe('system prompt: fidelity contract', () => {
  it('omits the Fidelity Contract section when fidelity is not set', () => {
    const prompt = flatten({
      deck: makeDeck(),
      activeSlideId: 'slide-1',
    })
    expect(prompt).not.toContain('Fidelity Contract')
    expect(prompt).not.toContain('STRICT')
    expect(prompt).not.toContain('[strict-locked]')
  })

  it('omits the contract for balanced/interpretive decks', () => {
    for (const fidelity of ['balanced', 'interpretive'] as const) {
      const prompt = flatten({
        deck: makeDeck(['block-locked']),
        activeSlideId: 'slide-1',
        fidelity,
      })
      expect(prompt).not.toContain('Fidelity Contract: STRICT')
    }
  })

  it('adds the Fidelity Contract section when fidelity=strict', () => {
    const prompt = flatten({
      deck: makeDeck(['block-locked']),
      activeSlideId: 'slide-1',
      fidelity: 'strict',
    })
    expect(prompt).toContain('## Fidelity Contract: STRICT')
    expect(prompt).toContain('verbatim')
    expect(prompt).toContain('must NOT')
  })

  it('marks blocks with sourceNodeIds as [strict-locked] in slide detail', () => {
    const prompt = flatten({
      deck: makeDeck(['block-locked']),
      activeSlideId: 'slide-1',
      fidelity: 'strict',
    })
    // block-locked has sourceNodeIds → should be marked
    expect(prompt).toMatch(/Module "block-locked"[^\n]*\[strict-locked\]/)
    // block-free has no sourceNodeIds → not marked
    expect(prompt).not.toMatch(/Module "block-free"[^\n]*\[strict-locked\]/)
    expect(prompt).not.toMatch(/Module "block-free-2"[^\n]*\[strict-locked\]/)
  })

  it('lists the locked block IDs in the contract section', () => {
    const prompt = flatten({
      deck: makeDeck(['block-locked']),
      activeSlideId: 'slide-1',
      fidelity: 'strict',
    })
    expect(prompt).toContain('Strict-locked block IDs:')
    expect(prompt).toContain('"block-locked"')
    // Non-locked block IDs should not appear on the Strict-locked block IDs line
    const contractIdx = prompt.indexOf('Strict-locked block IDs:')
    const lineEnd = prompt.indexOf('\n', contractIdx)
    const contractLine = prompt.slice(contractIdx, lineEnd === -1 ? undefined : lineEnd)
    expect(contractLine).not.toContain('"block-free"')
  })

  it('includes the original outline when outlineMarkdown is provided', () => {
    const outline = '# Test Title\n\n## Section\n- Point A\n- Point B'
    const prompt = flatten({
      deck: makeDeck(['block-locked']),
      activeSlideId: 'slide-1',
      fidelity: 'strict',
      outlineMarkdown: outline,
    })
    expect(prompt).toContain('## Original Outline')
    expect(prompt).toContain(outline)
  })

  it('handles strict fidelity with no locked blocks (just-created strict deck)', () => {
    const prompt = flatten({
      deck: makeDeck([]), // no blocks have sourceNodeIds
      activeSlideId: 'slide-1',
      fidelity: 'strict',
    })
    expect(prompt).toContain('## Fidelity Contract: STRICT')
    expect(prompt).toContain('(none yet)')
  })

  it('skips the Original Outline section when outlineMarkdown is empty', () => {
    const prompt = flatten({
      deck: makeDeck(['block-locked']),
      activeSlideId: 'slide-1',
      fidelity: 'strict',
      outlineMarkdown: undefined,
    })
    expect(prompt).toContain('## Fidelity Contract: STRICT')
    expect(prompt).not.toContain('## Original Outline')
  })
})
