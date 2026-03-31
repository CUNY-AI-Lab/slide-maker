import { describe, it, expect, beforeEach } from 'vitest'
import { renderModule, clearExtractedArtifacts, getExtractedArtifacts } from '../apps/api/src/export/html-renderer'

describe('export artifact extraction', () => {
  beforeEach(() => {
    clearExtractedArtifacts()
  })

  it('extracts rawSource artifacts to separate files when extractArtifacts is true', () => {
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { rawSource: '<html><body><canvas id="c"></canvas></body></html>', alt: 'Test viz' },
      order: 0,
    }
    const html = renderModule(mod, [], { extractArtifacts: true })
    expect(html).toContain('src="artifacts/')
    expect(html).toContain('.html"')
    expect(html).not.toContain('srcdoc=')
    expect(html).toContain('sandbox="allow-scripts"')
    expect(html).toContain('title="Test viz"')
  })

  it('populates extractedArtifacts map with the HTML source', () => {
    const source = '<html><body>hello</body></html>'
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { rawSource: source, alt: 'Test' },
      order: 0,
    }
    renderModule(mod, [], { extractArtifacts: true })
    const artifacts = getExtractedArtifacts()
    expect(artifacts.size).toBe(1)
    const [filename, content] = [...artifacts.entries()][0]
    expect(filename).toMatch(/^artifact-.+\.html$/)
    expect(content).toBe(source)
  })

  it('inlines srcdoc when extractArtifacts is not set', () => {
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { rawSource: '<html><body>test</body></html>', alt: 'Test viz' },
      order: 0,
    }
    const html = renderModule(mod)
    expect(html).toContain('srcdoc=')
    expect(html).not.toContain('src="artifacts/')
  })

  it('uses iframe src for URL-based artifacts regardless of extractArtifacts', () => {
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { src: 'https://example.com/viz.html', alt: 'External viz' },
      order: 0,
    }
    const html = renderModule(mod, [], { extractArtifacts: true })
    expect(html).toContain('src="https://example.com/viz.html"')
    expect(html).not.toContain('srcdoc=')
    expect(html).not.toContain('src="artifacts/')
  })

  it('deduplicates identical artifacts by content hash', () => {
    const source = '<html><body>same content</body></html>'
    const mod1 = { type: 'artifact' as const, zone: 'main', data: { rawSource: source, alt: 'A' }, order: 0 }
    const mod2 = { type: 'artifact' as const, zone: 'main', data: { rawSource: source, alt: 'B' }, order: 1 }
    renderModule(mod1, [], { extractArtifacts: true })
    renderModule(mod2, [], { extractArtifacts: true })
    const artifacts = getExtractedArtifacts()
    expect(artifacts.size).toBe(1)
  })

  it('renders placeholder for artifacts with no source', () => {
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { alt: 'Missing viz' },
      order: 0,
    }
    const html = renderModule(mod)
    expect(html).toContain('Missing viz')
    expect(html).not.toContain('<iframe')
  })

  it('handles step attributes on extracted artifacts', () => {
    const mod = {
      type: 'artifact' as const,
      zone: 'main',
      data: { rawSource: '<html><body>stepped</body></html>', alt: 'Stepped viz' },
      order: 0,
      stepOrder: 2,
    }
    const html = renderModule(mod, [], { extractArtifacts: true })
    expect(html).toContain('data-step="2"')
    expect(html).toContain('step-hidden')
    expect(html).toContain('src="artifacts/')
  })

  it('clears extracted artifacts between renders', () => {
    const mod = { type: 'artifact' as const, zone: 'main', data: { rawSource: '<html>a</html>' }, order: 0 }
    renderModule(mod, [], { extractArtifacts: true })
    expect(getExtractedArtifacts().size).toBe(1)
    clearExtractedArtifacts()
    expect(getExtractedArtifacts().size).toBe(0)
  })
})
