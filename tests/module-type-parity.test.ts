import { describe, it, expect } from 'vitest'
import { renderModule } from '../apps/api/src/export/html-renderer'
import { buildSystemPrompt } from '../apps/api/src/prompts/system'
import { MODULE_TYPES } from '../packages/shared/src/block-types'

describe('module type parity', () => {
  describe('html-renderer rejects phantom types', () => {
    it('renders code type as default JSON fallback, not formatted HTML', () => {
      const mod = {
        type: 'code' as any,
        zone: 'main',
        data: { code: 'console.log("hi")', language: 'js' },
        order: 0,
      }
      const html = renderModule(mod)
      expect(html).not.toContain('code-wrapper')
      expect(html).not.toContain('<pre>')
      expect(html).toContain('text-body')
    })

    it('renders quote type as default JSON fallback, not blockquote', () => {
      const mod = {
        type: 'quote' as any,
        zone: 'main',
        data: { quote: 'To be or not to be', cite: 'Shakespeare' },
        order: 0,
      }
      const html = renderModule(mod)
      expect(html).not.toContain('<blockquote')
      expect(html).not.toContain('<cite>')
      expect(html).toContain('text-body')
    })

    it('renders any invented type as default JSON fallback', () => {
      const mod = {
        type: 'timeline' as any,
        zone: 'main',
        data: { events: [{ date: '2025', label: 'Launch' }] },
        order: 0,
      }
      const html = renderModule(mod)
      expect(html).toContain('text-body')
      // Fallback renders JSON-stringified data, not semantic HTML
      expect(html).toContain('&quot;events&quot;')
    })
  })

  describe('all valid MODULE_TYPES produce non-fallback HTML', () => {
    const minimalData: Record<string, Record<string, unknown>> = {
      heading: { text: 'Title', level: 2 },
      text: { markdown: 'Hello world' },
      card: { content: 'Info' },
      label: { text: 'Section', color: 'cyan' },
      'tip-box': { content: 'Note' },
      'prompt-block': { content: 'code here' },
      image: { src: '/api/decks/d/files/f', alt: 'Photo' },
      carousel: { items: [{ src: '/img.jpg' }] },
      comparison: { panels: [{ title: 'A', content: 'a' }, { title: 'B', content: 'b' }] },
      'card-grid': { cards: [{ title: 'Card', content: 'body' }] },
      flow: { nodes: [{ label: 'Step 1' }] },
      'stream-list': { items: ['one', 'two'] },
      artifact: { artifactName: 'Timeline', alt: 'Timeline', config: { events: [] } },
      video: { url: 'https://youtube.com/watch?v=abc123' },
    }

    for (const type of MODULE_TYPES) {
      it(`renders ${type} without falling to default JSON dump`, () => {
        const mod = { type, zone: 'main', data: minimalData[type] ?? {}, order: 0 }
        const html = renderModule(mod as any)
        // The default fallback wraps raw JSON in a text-body div.
        // Valid types should produce semantic HTML, not a JSON dump.
        if (type === 'artifact') {
          expect(html).toMatch(/artifact-wrapper|artifact-native/)
        } else if (type === 'text') {
          // text type legitimately uses text-body class, but renders HTML tags inside
          expect(html).toContain('text-body')
          expect(html).toMatch(/<p>|<ul>|<ol>/)
        } else {
          expect(html).not.toMatch(/"text-body"/)
        }
      })
    }
  })

  describe('system prompt consistency', () => {
    const baseOpts: any = {
      deck: { id: 'd1', name: 'Test', themeId: null, slides: [] },
      activeSlideId: null,
      templates: [],
      theme: null,
      files: [],
      artifacts: [],
      activeArtifacts: [],
    }

    it('module type count matches MODULE_TYPES length', () => {
      const prompt = buildSystemPrompt(baseOpts)
      const headerMatch = prompt.match(/Module Types \((\d+) types\)/)
      expect(headerMatch).not.toBeNull()
      expect(Number(headerMatch![1])).toBe(MODULE_TYPES.length)
    })

    it('all "Use ONLY the N module types" references agree', () => {
      const prompt = buildSystemPrompt(baseOpts)
      const matches = [...prompt.matchAll(/Use ONLY the (\d+) module types/g)]
      expect(matches.length).toBeGreaterThanOrEqual(2)
      for (const m of matches) {
        expect(Number(m[1])).toBe(MODULE_TYPES.length)
      }
    })

    it('artifact data shape includes config field', () => {
      const prompt = buildSystemPrompt(baseOpts)
      const artifactLine = prompt.split('\n').find((l) => l.includes('**artifact**'))
      expect(artifactLine).toBeDefined()
      expect(artifactLine).toContain('config')
    })
  })
})
