import { describe, it, expect } from 'vitest'
import { getResolvedConfig, buildAtRef, type ArtifactRef } from '../apps/web/src/lib/utils/artifact-config'
import { buildSourceWithConfig } from '../apps/web/src/lib/utils/artifact-config'

// ── Fixtures ────────────────────────────────────────────

const flatArtifact: ArtifactRef = {
  id: 'artifact-boids',
  name: 'Boids Visualization',
  description: 'Interactive boids visualization',
  type: 'visualization',
  source: 'https://creative-clawing.com/gallery/boids.html',
  config: { width: '100%', height: '400px', sandbox: 'allow-scripts' },
}

const schemaArtifact: ArtifactRef = {
  id: 'artifact-bar',
  name: 'Bar Chart',
  description: 'Configurable bar chart',
  type: 'chart',
  source: '<html><body></body></html>',
  config: {
    title: { type: 'string', label: 'Title', default: 'My Chart' },
    values: { type: 'array', label: 'Values', default: [10, 20, 30] },
    color: { type: 'string', label: 'Bar Color', default: '#3b82f6' },
  },
}

const nullConfigArtifact: ArtifactRef = {
  id: 'artifact-empty',
  name: 'Empty Visualization',
  description: 'No config',
  type: 'visualization',
  source: 'https://example.com/visualization.html',
  config: null,
}

const emptyConfigArtifact: ArtifactRef = {
  id: 'artifact-empty2',
  name: 'Empty Config',
  description: 'Empty object config',
  type: 'visualization',
  source: 'https://example.com/visualization.html',
  config: {},
}

// ── getResolvedConfig ───────────────────────────────────

describe('getResolvedConfig', () => {
  it('returns flat config values as-is', () => {
    const result = getResolvedConfig(flatArtifact)
    expect(result).toEqual({
      width: '100%',
      height: '400px',
      sandbox: 'allow-scripts',
    })
  })

  it('extracts .default from schema config fields', () => {
    const result = getResolvedConfig(schemaArtifact)
    expect(result).toEqual({
      title: 'My Chart',
      values: [10, 20, 30],
      color: '#3b82f6',
    })
  })

  it('returns {} for null config', () => {
    expect(getResolvedConfig(nullConfigArtifact)).toEqual({})
  })

  it('returns {} for empty object config', () => {
    expect(getResolvedConfig(emptyConfigArtifact)).toEqual({})
  })

  it('handles mixed schema — fields with .default are extracted, others skipped', () => {
    const mixed: ArtifactRef = {
      ...flatArtifact,
      config: {
        title: { type: 'string', label: 'Title', default: 'Hello' },
        stray: 'not-a-schema-field',
      },
    }
    const result = getResolvedConfig(mixed)
    // hasSchema is true because at least one value has .default
    expect(result).toEqual({ title: 'Hello' })
  })
})

// ── buildAtRef ──────────────────────────────────────────

describe('buildAtRef', () => {
  it('starts with @artifact:<name>', () => {
    const ref = buildAtRef(flatArtifact)
    expect(ref.startsWith('@artifact:Boids Visualization')).toBe(true)
  })

  it('contains a json fenced code block', () => {
    const ref = buildAtRef(flatArtifact)
    expect(ref).toContain('```json')
    expect(ref).toContain('```')
  })

  it('includes name, type, source, and resolved config in payload', () => {
    const ref = buildAtRef(flatArtifact)
    const jsonBlock = ref.split('```json\n')[1].split('\n```')[0]
    const payload = JSON.parse(jsonBlock)
    expect(payload.name).toBe('Boids Visualization')
    expect(payload.type).toBe('visualization')
    expect(payload.source).toBe('https://creative-clawing.com/gallery/boids.html')
    expect(payload.config).toEqual({
      width: '100%',
      height: '400px',
      sandbox: 'allow-scripts',
    })
  })

  it('resolves schema config defaults in the payload', () => {
    const ref = buildAtRef(schemaArtifact)
    const jsonBlock = ref.split('```json\n')[1].split('\n```')[0]
    const payload = JSON.parse(jsonBlock)
    expect(payload.config).toEqual({
      title: 'My Chart',
      values: [10, 20, 30],
      color: '#3b82f6',
    })
  })

  it('produces empty config object for null config artifacts', () => {
    const ref = buildAtRef(nullConfigArtifact)
    const jsonBlock = ref.split('```json\n')[1].split('\n```')[0]
    const payload = JSON.parse(jsonBlock)
    expect(payload.config).toEqual({})
  })
})

// ── Rich schema types (number, color, boolean, select) ──

describe('getResolvedConfig with rich schemas', () => {
  it('extracts defaults from number/color/boolean/select fields', () => {
    const artifact: ArtifactRef = {
      id: 'artifact-lorenz',
      name: 'Lorenz Attractor',
      description: 'Chaotic attractor',
      type: 'visualization',
      source: '<html><body></body></html>',
      config: {
        sigma: { type: 'number', label: 'Sigma', default: 10, min: 1, max: 30 },
        rho: { type: 'number', label: 'Rho', default: 28, min: 10, max: 50 },
        color: { type: 'color', label: 'Trail Color', default: '#ff0000' },
        autoRotate: { type: 'boolean', label: 'Auto Rotate', default: true },
        mode: { type: 'select', label: 'Mode', default: 'arcs', options: ['arcs', 'triangles'] },
      },
    }
    const result = getResolvedConfig(artifact)
    expect(result).toEqual({
      sigma: 10,
      rho: 28,
      color: '#ff0000',
      autoRotate: true,
      mode: 'arcs',
    })
  })

  it('merges partial config with resolved defaults', () => {
    const artifact: ArtifactRef = {
      id: 'artifact-boids',
      name: 'Boids',
      description: 'Flocking',
      type: 'visualization',
      source: '<html><body></body></html>',
      config: {
        count: { type: 'number', label: 'Count', default: 120, min: 20, max: 400 },
        maxSpeed: { type: 'number', label: 'Max Speed', default: 2.2, min: 0.5, max: 5 },
      },
    }
    const defaults = getResolvedConfig(artifact)
    const merged = { ...defaults, count: 200 }
    expect(merged).toEqual({ count: 200, maxSpeed: 2.2 })
  })
})

// ── Mutation extraction ─────────────────────────────────

describe('extractMutations (updateArtifactConfig)', () => {
  // Pure reimplementation of extractMutations for testing (original has Svelte store deps)
  function extractMutations(text: string): Record<string, unknown>[] {
    const mutations: Record<string, unknown>[] = []
    const regex = /```mutation\s*\n([\s\S]*?)```/g
    let match
    while ((match = regex.exec(text)) !== null) {
      try { mutations.push(JSON.parse(match[1].trim())) } catch { /* skip */ }
    }
    return mutations
  }

  it('extracts updateArtifactConfig mutation from fenced block', () => {
    const text = `Sure, I'll make the boids faster!

\`\`\`mutation
{
  "action": "updateArtifactConfig",
  "payload": {
    "artifactName": "Boids",
    "config": { "count": 200, "maxSpeed": 3.5 }
  }
}
\`\`\`

That should give you a bigger, faster flock.`

    const mutations = extractMutations(text)
    expect(mutations).toHaveLength(1)
    expect(mutations[0].action).toBe('updateArtifactConfig')
    const payload = mutations[0].payload as { artifactName: string; config: Record<string, unknown> }
    expect(payload.artifactName).toBe('Boids')
    expect(payload.config).toEqual({ count: 200, maxSpeed: 3.5 })
  })

  it('extracts multiple mutations including updateArtifactConfig', () => {
    const text = `\`\`\`mutation
{"action":"addSlide","payload":{"layout":"layout-split","modules":[]}}
\`\`\`

\`\`\`mutation
{"action":"updateArtifactConfig","payload":{"artifactName":"Lorenz Attractor","config":{"sigma":15}}}
\`\`\`
`
    const mutations = extractMutations(text)
    expect(mutations).toHaveLength(2)
    expect(mutations[0].action).toBe('addSlide')
    expect(mutations[1].action).toBe('updateArtifactConfig')
  })
})

describe('buildSourceWithConfig', () => {
  it('injects data-config when none present', () => {
    const src = '<html><body><div id="app"></div></body></html>'
    const out = buildSourceWithConfig(src, { a: 1 })
    expect(out).toContain('data-config="{&quot;a&quot;:1}"')
  })

  it('replaces existing data-config attribute', () => {
    const src = '<html><body data-config="{&quot;a&quot;:1}"><div></div></body></html>'
    const out = buildSourceWithConfig(src, { a: 2, b: 3 })
    expect(out).toContain('data-config="{&quot;a&quot;:2,&quot;b&quot;:3}"')
    // not duplicated
    expect(out.match(/data-config=/g)?.length).toBe(1)
  })
})
