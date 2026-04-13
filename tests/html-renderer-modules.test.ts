import { describe, it, expect, beforeEach } from 'vitest'
import { renderModule, clearExtractedArtifacts } from '../apps/api/src/export/html-renderer'

function mod(type: string, data: Record<string, unknown>, stepOrder?: number | null) {
  return { type, zone: 'main', data, order: 0, stepOrder: stepOrder ?? null }
}

describe('renderModule — per-type HTML output', () => {
  // ── heading ────────────────────────────────────────────────
  describe('heading', () => {
    it('renders correct heading level', () => {
      expect(renderModule(mod('heading', { text: 'Title', level: 1 }))).toMatch(/^<h1[^>]*>Title<\/h1>$/)
      expect(renderModule(mod('heading', { text: 'Sub', level: 3 }))).toMatch(/^<h3[^>]*>Sub<\/h3>$/)
    })

    it('clamps level to 1-4', () => {
      expect(renderModule(mod('heading', { text: 'T', level: 0 }))).toMatch(/^<h1/)
      expect(renderModule(mod('heading', { text: 'T', level: 99 }))).toMatch(/^<h4/)
    })

    it('strips dangerous HTML from text content', () => {
      const html = renderModule(mod('heading', { text: '<script>xss</script>', level: 2 }))
      expect(html).not.toContain('<script>')
      expect(html).not.toContain('xss')
    })

    it('applies fontSize and align styles', () => {
      const html = renderModule(mod('heading', { text: 'T', level: 1, fontSize: '2rem', align: 'center' }))
      expect(html).toContain('font-size: 2rem')
      expect(html).toContain('text-align: center')
    })
  })

  // ── text ───────────────────────────────────────────────────
  describe('text', () => {
    it('renders markdown content in text-body div', () => {
      const html = renderModule(mod('text', { markdown: '**bold**' }))
      expect(html).toContain('class="text-body"')
      expect(html).toContain('<strong>bold</strong>')
    })

    it('adds step-hidden class with stepOrder', () => {
      const html = renderModule(mod('text', { markdown: 'step' }, 2))
      expect(html).toContain('step-hidden')
      expect(html).toContain('data-step="2"')
    })

    it('returns empty string for empty data', () => {
      expect(renderModule(mod('text', {}))).toBe('')
    })
  })

  // ── card ───────────────────────────────────────────────────
  describe('card', () => {
    it('renders with variant class', () => {
      const html = renderModule(mod('card', { content: 'info', variant: 'cyan' }))
      expect(html).toContain('card card-cyan')
    })

    it('renders title in h3', () => {
      const html = renderModule(mod('card', { title: 'Header', content: 'body' }))
      expect(html).toContain('<h3>Header</h3>')
    })

    it('falls back from body to content field', () => {
      const html1 = renderModule(mod('card', { body: 'from body' }))
      const html2 = renderModule(mod('card', { content: 'from content' }))
      expect(html1).toContain('from body')
      expect(html2).toContain('from content')
    })

    it('escapes title content', () => {
      const html = renderModule(mod('card', { title: '<img onerror=alert(1)>', content: 'x' }))
      expect(html).toContain('&lt;img')
      expect(html).not.toContain('<img ')
    })
  })

  // ── label ──────────────────────────────────────────────────
  describe('label', () => {
    it('renders span with color class', () => {
      const html = renderModule(mod('label', { text: 'Section', color: 'cyan' }))
      expect(html).toContain('<span class="label label-cyan"')
      expect(html).toContain('Section')
    })

    it('renders without color class when absent', () => {
      const html = renderModule(mod('label', { text: 'Tag' }))
      expect(html).toContain('class="label"')
    })
  })

  // ── tip-box ────────────────────────────────────────────────
  describe('tip-box', () => {
    it('renders title in strong tag', () => {
      const html = renderModule(mod('tip-box', { title: 'Note', content: 'body' }))
      expect(html).toContain('<strong>Note</strong>')
      expect(html).toContain('class="tip-box"')
    })

    it('wraps body in tip-box-content div', () => {
      const html = renderModule(mod('tip-box', { content: 'important info' }))
      expect(html).toContain('tip-box-content')
      expect(html).toContain('important info')
    })

    it('falls back to text field', () => {
      const html = renderModule(mod('tip-box', { text: 'fallback' }))
      expect(html).toContain('fallback')
    })
  })

  // ── prompt-block ───────────────────────────────────────────
  describe('prompt-block', () => {
    it('wraps content in pre tag', () => {
      const html = renderModule(mod('prompt-block', { content: 'code here' }))
      expect(html).toContain('<pre>')
      expect(html).toContain('code here')
    })

    it('applies quality class', () => {
      const html = renderModule(mod('prompt-block', { content: 'x', quality: 'good' }))
      expect(html).toContain('prompt-block prompt-good')
    })

    it('escapes content', () => {
      const html = renderModule(mod('prompt-block', { content: '<b>xss</b>' }))
      expect(html).toContain('&lt;b&gt;')
    })
  })

  // ── image ──────────────────────────────────────────────────
  describe('image', () => {
    it('renders figure with img', () => {
      const html = renderModule(mod('image', { src: '/img.jpg', alt: 'Photo' }))
      expect(html).toContain('<figure')
      expect(html).toContain('<img')
      expect(html).toContain('alt="Photo"')
      expect(html).toContain('loading="lazy"')
    })

    it('renders optional figcaption', () => {
      const html = renderModule(mod('image', { src: '/img.jpg', caption: 'A photo' }))
      expect(html).toContain('<figcaption>A photo</figcaption>')
    })

    it('omits figcaption when no caption', () => {
      const html = renderModule(mod('image', { src: '/img.jpg' }))
      expect(html).not.toContain('figcaption')
    })

    it('rewrites API file URLs to assets/', () => {
      const files = [{ id: 'f1', filename: 'photo.png' }]
      const html = renderModule(mod('image', { src: '/api/decks/d1/files/f1' }), files)
      expect(html).toContain('assets/f1.png')
    })
  })

  // ── carousel ───────────────────────────────────────────────
  describe('carousel', () => {
    const items = [{ src: '/a.jpg', alt: 'A' }, { src: '/b.jpg', alt: 'B' }]

    it('renders prev/next buttons with aria-labels', () => {
      const html = renderModule(mod('carousel', { items }))
      expect(html).toContain('aria-label="Previous"')
      expect(html).toContain('aria-label="Next"')
    })

    it('renders carousel items', () => {
      const html = renderModule(mod('carousel', { items }))
      expect((html.match(/carousel-item/g) || []).length).toBe(2)
    })

    it('renders dots with aria-labels', () => {
      const html = renderModule(mod('carousel', { items }))
      expect(html).toContain('aria-label="Go to image 1"')
      expect(html).toContain('aria-label="Go to image 2"')
    })

    it('adds syncSteps and interval attributes', () => {
      const html = renderModule(mod('carousel', { items, syncSteps: true, interval: 3000 }))
      expect(html).toContain('data-sync-steps')
      expect(html).toContain('data-interval="3000"')
    })

    it('handles empty items array', () => {
      const html = renderModule(mod('carousel', { items: [] }))
      expect(html).toContain('carousel')
      expect(html).not.toContain('carousel-item')
    })
  })

  // ── comparison ─────────────────────────────────────────────
  describe('comparison', () => {
    it('renders panels with titles and content', () => {
      const panels = [
        { title: 'Left', content: 'left body' },
        { title: 'Right', content: 'right body' },
      ]
      const html = renderModule(mod('comparison', { panels }))
      expect((html.match(/comparison-panel/g) || []).length).toBe(2)
      expect(html).toContain('<h3>Left</h3>')
      expect(html).toContain('<h3>Right</h3>')
    })

    it('wraps panel body in panel-content div', () => {
      const panels = [{ title: 'A', content: 'panel body' }]
      const html = renderModule(mod('comparison', { panels }))
      expect(html).toContain('panel-content')
      expect(html).toContain('panel body')
    })

    it('falls back from body to content field', () => {
      const panels = [{ title: 'A', body: 'from body' }]
      const html = renderModule(mod('comparison', { panels }))
      expect(html).toContain('from body')
    })

    it('handles empty panels', () => {
      const html = renderModule(mod('comparison', { panels: [] }))
      expect(html).toContain('comparison')
      expect(html).not.toContain('comparison-panel')
    })
  })

  // ── card-grid ──────────────────────────────────────────────
  describe('card-grid', () => {
    it('sets grid columns from columns field', () => {
      const cards = [{ title: 'A', content: 'a' }]
      const html = renderModule(mod('card-grid', { cards, columns: 4 }))
      expect(html).toContain('repeat(4, 1fr)')
    })

    it('defaults to 3 columns', () => {
      const html = renderModule(mod('card-grid', { cards: [{ title: 'A', content: 'a' }] }))
      expect(html).toContain('repeat(3, 1fr)')
    })

    it('renders card variant classes', () => {
      const cards = [{ title: 'A', content: 'a', variant: 'navy' }]
      const html = renderModule(mod('card-grid', { cards }))
      expect(html).toContain('card card-navy')
    })
  })

  // ── flow ───────────────────────────────────────────────────
  describe('flow', () => {
    it('renders nodes with labels', () => {
      const nodes = [{ label: 'Start' }, { label: 'End' }]
      const html = renderModule(mod('flow', { nodes }))
      expect((html.match(/flow-node/g) || []).length).toBe(2)
      expect(html).toContain('Start')
      expect(html).toContain('End')
    })

    it('renders icon/label/description structure matching canvas', () => {
      const nodes = [{ label: 'Step', icon: '✓', description: 'Do the thing' }]
      const html = renderModule(mod('flow', { nodes }))
      expect(html).toContain('flow-icon')
      expect(html).toContain('flow-label')
      expect(html).toContain('flow-body')
      expect(html).toContain('flow-desc')
      expect(html).toContain('✓')
      expect(html).toContain('Do the thing')
    })

    it('defaults icon to node number when not specified', () => {
      const nodes = [{ label: 'First' }, { label: 'Second' }]
      const html = renderModule(mod('flow', { nodes }))
      expect(html).toContain('>1<')
      expect(html).toContain('>2<')
    })

    it('omits flow-desc when no description', () => {
      const html = renderModule(mod('flow', { nodes: [{ label: 'Only label' }] }))
      expect(html).not.toContain('flow-desc')
      expect(html).toContain('flow-label')
    })

    it('renders arrows between nodes', () => {
      const nodes = [{ label: 'A' }, { label: 'B' }, { label: 'C' }]
      const html = renderModule(mod('flow', { nodes }))
      expect((html.match(/flow-arrow/g) || []).length).toBe(2)
    })

    it('sanitizes node labels (preserves safe tags, strips dangerous ones)', () => {
      const safe = renderModule(mod('flow', { nodes: [{ label: '<b>bold</b>' }] }))
      expect(safe).toContain('<b>bold</b>')
      const dangerous = renderModule(mod('flow', { nodes: [{ label: '<script>alert(1)</script>' }] }))
      expect(dangerous).not.toContain('<script>')
    })
  })

  // ── stream-list ────────────────────────────────────────────
  describe('stream-list', () => {
    it('renders string items as list', () => {
      const html = renderModule(mod('stream-list', { items: ['one', 'two'] }))
      expect(html).toContain('<ul class="stream-list"')
      expect((html.match(/<li>/g) || []).length).toBe(2)
    })

    it('handles object items with text/content/label fields', () => {
      const items = [{ text: 'from text' }, { content: 'from content' }, { label: 'from label' }]
      const html = renderModule(mod('stream-list', { items }))
      expect(html).toContain('from text')
      expect(html).toContain('from content')
      expect(html).toContain('from label')
    })
  })

  // ── video ──────────────────────────────────────────────────
  describe('video', () => {
    it('parses YouTube watch URL to embed', () => {
      const html = renderModule(mod('video', { url: 'https://youtube.com/watch?v=abc123' }))
      expect(html).toContain('src="https://www.youtube.com/embed/abc123"')
    })

    it('parses youtu.be short URL', () => {
      const html = renderModule(mod('video', { url: 'https://youtu.be/xyz789' }))
      expect(html).toContain('src="https://www.youtube.com/embed/xyz789"')
    })

    it('parses Vimeo URL', () => {
      const html = renderModule(mod('video', { url: 'https://vimeo.com/123456' }))
      expect(html).toContain('src="https://player.vimeo.com/video/123456"')
    })

    it('parses Loom share URL', () => {
      const html = renderModule(mod('video', { url: 'https://www.loom.com/share/abcdef' }))
      expect(html).toContain('src="https://www.loom.com/embed/abcdef"')
    })

    it('renders caption', () => {
      const html = renderModule(mod('video', { url: 'https://youtube.com/watch?v=x', caption: 'Demo' }))
      expect(html).toContain('video-caption')
      expect(html).toContain('Demo')
    })

    it('returns empty string for invalid URL', () => {
      expect(renderModule(mod('video', { url: 'not-a-url' }))).toBe('')
    })

    it('returns empty string for non-video URL', () => {
      expect(renderModule(mod('video', { url: 'https://example.com/page' }))).toBe('')
    })
  })

  // ── artifact ───────────────────────────────────────────────
  describe('artifact', () => {
    beforeEach(() => clearExtractedArtifacts())

    it('renders native artifact with data attributes', () => {
      // Timeline is a NATIVE_ARTIFACT_NAMES entry
      const html = renderModule(mod('artifact', {
        artifactName: 'Timeline',
        config: { events: [] },
      }))
      expect(html).toContain('artifact-native')
      expect(html).toContain('data-artifact="Timeline"')
      expect(html).toContain('data-config=')
    })

    it('renders URL artifact as iframe', () => {
      const html = renderModule(mod('artifact', { src: 'https://example.com/viz' }))
      expect(html).toContain('<iframe')
      expect(html).toContain('sandbox="allow-scripts"')
      expect(html).toContain('src="https://example.com/viz"')
    })

    it('renders rawSource as srcdoc iframe', () => {
      const html = renderModule(mod('artifact', { rawSource: '<h1>Hello</h1>' }))
      expect(html).toContain('srcdoc=')
      expect(html).toContain('sandbox="allow-scripts"')
    })

    it('renders placeholder when no source', () => {
      const html = renderModule(mod('artifact', { alt: 'Missing viz' }))
      expect(html).toContain('Missing viz')
      expect(html).toContain('artifact-wrapper')
      expect(html).not.toContain('iframe')
      expect(html).not.toContain('artifact-native')
    })

    it('applies width and height styles', () => {
      const html = renderModule(mod('artifact', {
        artifactName: 'Timeline',
        config: {},
        width: '600px',
        height: '400px',
      }))
      expect(html).toContain('width:600px')
      expect(html).toContain('height:400px')
    })
  })

  // ── step attributes ────────────────────────────────────────
  describe('step attributes', () => {
    it('adds step-hidden and data-step for stepOrder', () => {
      const html = renderModule(mod('heading', { text: 'T', level: 1 }, 3))
      expect(html).toContain('step-hidden')
      expect(html).toContain('data-step="3"')
    })

    it('omits step attributes when stepOrder is null', () => {
      const html = renderModule(mod('heading', { text: 'T', level: 1 }))
      expect(html).not.toContain('step-hidden')
      expect(html).not.toContain('data-step')
    })
  })

  // ── default fallback ───────────────────────────────────────
  describe('default fallback', () => {
    it('renders unknown type as JSON in text-body div', () => {
      const html = renderModule(mod('unknown' as any, { foo: 'bar' }))
      expect(html).toContain('text-body')
      expect(html).toContain('&quot;foo&quot;')
    })
  })
})
