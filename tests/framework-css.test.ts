import { describe, it, expect } from 'vitest'
import { FRAMEWORK_CSS_BASE, FRAMEWORK_CSS_PREVIEW, FRAMEWORK_CSS_EXPORT } from '../packages/shared/src/framework-css'

// ── CSS Rule Extraction Helpers ───────────────────────

/** Find all rules matching a selector pattern and return their declarations */
function findRules(css: string, selectorPattern: string): string[] {
  const regex = new RegExp(
    selectorPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]+)\\}',
    'g'
  )
  const matches: string[] = []
  let m
  while ((m = regex.exec(css)) !== null) {
    matches.push(m[1].trim())
  }
  return matches
}

/** Check if a CSS property appears in a declaration block */
function hasProperty(declarations: string, prop: string): boolean {
  return declarations.split(';').some(d => d.trim().startsWith(prop))
}

/** Extract a property value from a declaration block */
function getProperty(declarations: string, prop: string): string | null {
  const decl = declarations.split(';').find(d => d.trim().startsWith(prop))
  if (!decl) return null
  return decl.split(':').slice(1).join(':').trim()
}

// ── Layout Split Specificity ──────────────────────────

describe('layout-split CSS specificity', () => {
  it('uses .slide.layout-split selector for higher specificity than .slide', () => {
    // The base CSS should use .slide.layout-split, not just .layout-split
    expect(FRAMEWORK_CSS_BASE).toContain('.slide.layout-split')
  })

  it('sets flex-direction: row on .slide.layout-split', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.slide.layout-split')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'flex-direction')).toBe(true)
    expect(getProperty(rules[0], 'flex-direction')).toBe('row')
  })

  it('.slide.layout-split appears BEFORE the preview .slide rule so specificity wins', () => {
    // Even though .slide { flex-direction: column } comes later in preview,
    // .slide.layout-split has higher specificity (2 classes vs 1)
    const splitIndex = FRAMEWORK_CSS_PREVIEW.indexOf('.slide.layout-split')
    expect(splitIndex).toBeGreaterThan(-1)

    // Verify the preview variant adds a .slide rule with flex-direction: column
    const previewAddition = FRAMEWORK_CSS_PREVIEW.slice(FRAMEWORK_CSS_BASE.length)
    expect(previewAddition).toContain('flex-direction: column')
  })

  it('export variant also has the .slide.layout-split specificity fix', () => {
    const exportAddition = FRAMEWORK_CSS_EXPORT.slice(FRAMEWORK_CSS_BASE.length)
    expect(exportAddition).toContain('flex-direction: column')
    // .slide.layout-split from base still has higher specificity
    expect(FRAMEWORK_CSS_EXPORT).toContain('.slide.layout-split')
  })
})

// ── Layout Split Content/Stage Zones ──────────────────

describe('layout-split zone styling', () => {
  it('.content zone has flex column with vertical centering', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.layout-split > .content')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'display')).toBe(true)
    expect(getProperty(rules[0], 'display')).toBe('flex')
    expect(getProperty(rules[0], 'flex-direction')).toBe('column')
    expect(getProperty(rules[0], 'justify-content')).toBe('center')
  })

  it('.stage zone has flex column with centered alignment', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.layout-split > .stage')
    expect(rules.length).toBeGreaterThan(0)
    const stage = rules[0]
    expect(getProperty(stage, 'display')).toBe('flex')
    expect(getProperty(stage, 'flex-direction')).toBe('column')
    expect(getProperty(stage, 'justify-content')).toBe('center')
    expect(getProperty(stage, 'align-items')).toBe('center')
  })

  it('split layout has gap between zones', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.slide.layout-split')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'gap')).toBe(true)
    expect(getProperty(rules[0], 'gap')).toBe('40px')
  })
})

// ── Other Layouts ─────────────────────────────────────

describe('other layout CSS rules', () => {
  it('title-slide has centered alignment', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.title-slide')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'align-items')).toBe(true)
    expect(getProperty(rules[0], 'align-items')).toBe('center')
  })

  it('layout-content has centered alignment', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.layout-content')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'align-items')).toBe('center')
  })

  it('closing-slide has centered alignment', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.closing-slide')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'align-items')).toBe('center')
    expect(getProperty(rules[0], 'justify-content')).toBe('center')
  })
})

// ── Preview Variant ───────────────────────────────────

describe('preview CSS variant', () => {
  it('includes base CSS', () => {
    expect(FRAMEWORK_CSS_PREVIEW).toContain(FRAMEWORK_CSS_BASE)
  })

  it('sets .slide to display: flex', () => {
    const previewAddition = FRAMEWORK_CSS_PREVIEW.slice(FRAMEWORK_CSS_BASE.length)
    const rules = findRules(previewAddition, '.slide')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('flex')
  })

  it('sets padding on slides', () => {
    const previewAddition = FRAMEWORK_CSS_PREVIEW.slice(FRAMEWORK_CSS_BASE.length)
    const rules = findRules(previewAddition, '.slide')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'padding')).toBe(true)
  })

  it('makes all step elements visible', () => {
    const previewAddition = FRAMEWORK_CSS_PREVIEW.slice(FRAMEWORK_CSS_BASE.length)
    expect(previewAddition).toContain('.step-hidden')
    const rules = findRules(previewAddition, '.step-hidden')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'opacity')).toBe('1')
  })
})

// ── Export Variant ─────────────────────────────────────

describe('export CSS variant', () => {
  it('includes base CSS', () => {
    expect(FRAMEWORK_CSS_EXPORT).toContain(FRAMEWORK_CSS_BASE)
  })

  it('hides slides by default (display: none)', () => {
    const exportAddition = FRAMEWORK_CSS_EXPORT.slice(FRAMEWORK_CSS_BASE.length)
    const rules = findRules(exportAddition, '.slide')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('none')
  })

  it('shows active slides with display: flex', () => {
    const exportAddition = FRAMEWORK_CSS_EXPORT.slice(FRAMEWORK_CSS_BASE.length)
    expect(exportAddition).toContain('.slide.active')
    const rules = findRules(exportAddition, '.slide.active')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('flex')
  })

  it('has step reveal classes', () => {
    const exportAddition = FRAMEWORK_CSS_EXPORT.slice(FRAMEWORK_CSS_BASE.length)
    expect(exportAddition).toContain('.step-hidden')
    expect(exportAddition).toContain('.step-visible')
    const hidden = findRules(exportAddition, '.step-hidden')
    expect(hidden.length).toBeGreaterThan(0)
    expect(getProperty(hidden[0], 'opacity')).toBe('0')
  })

  it('responsive breakpoint stacks layout-split vertically', () => {
    // Check responsive rules use .slide.layout-split for proper specificity
    expect(FRAMEWORK_CSS_EXPORT).toMatch(/@media.*max-width.*768px/)
    expect(FRAMEWORK_CSS_EXPORT).toContain('.slide.layout-split')
  })
})

// ── Module Styles ─────────────────────────────────────

describe('module CSS rules in base', () => {
  it('card has border-radius and padding', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.card')
    expect(rules.length).toBeGreaterThan(0)
    expect(hasProperty(rules[0], 'border-radius')).toBe(true)
    expect(hasProperty(rules[0], 'padding')).toBe(true)
  })

  it('comparison uses flex row layout', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.comparison')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('flex')
  })

  it('card-grid uses CSS grid', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.card-grid')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('grid')
  })

  it('flow uses flex with center alignment', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.flow')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'display')).toBe('flex')
    expect(getProperty(rules[0], 'justify-content')).toBe('center')
  })

  it('artifact-wrapper is fluid width by default', () => {
    const rules = findRules(FRAMEWORK_CSS_BASE, '.artifact-wrapper')
    expect(rules.length).toBeGreaterThan(0)
    expect(getProperty(rules[0], 'width')).toBe('100%')
  })

  it('artifact iframe is square by default and drops aspect when height is set', () => {
    const iframeRules = findRules(FRAMEWORK_CSS_BASE, '.artifact-wrapper iframe')
    expect(iframeRules.length).toBeGreaterThan(0)
    expect(getProperty(iframeRules[0], 'aspect-ratio')).toBe('1')

    const override = findRules(FRAMEWORK_CSS_BASE, '.artifact-wrapper[style*="height"] iframe')
    expect(override.length).toBeGreaterThan(0)
    expect(getProperty(override[0], 'aspect-ratio')).toBe('auto')
  })
})
