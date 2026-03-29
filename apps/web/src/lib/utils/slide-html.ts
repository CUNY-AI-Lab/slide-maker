/**
 * Client-side slide HTML renderer for iframe srcdoc preview.
 * Mirrors the logic in apps/api/src/export/html-renderer.ts
 * but renders a SINGLE slide (not a full deck) into a complete
 * HTML document with inline framework CSS.
 */

import { FRAMEWORK_CSS } from './framework-css-client'
import { isDark } from '$lib/stores/themes'

const API_URL = (import.meta as any).env?.PUBLIC_API_URL ?? 'http://localhost:3001'

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'

// ── Helpers ──────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function rewriteImageSrc(src: string): string {
  if (src.startsWith('/api/')) {
    return `${API_URL}${src}`
  }
  return src
}

// ── Types ────────────────────────────────────────────────────────────

interface Module {
  id?: string
  type: string
  zone: string
  data: Record<string, unknown>
  order: number
  stepOrder?: number | null
}

interface Slide {
  id: string
  layout: string
  order: number
  splitRatio?: string
  blocks: Module[]
}

interface ThemeColors {
  primary?: string
  secondary?: string
  accent?: string
  bg?: string
}

interface ThemeFonts {
  heading?: string
  body?: string
}

interface Theme {
  colors?: ThemeColors
  fonts?: ThemeFonts
}

// ── Module Rendering ─────────────────────────────────────────────────

function renderModule(mod: Module): string {
  const d = mod.data || {}

  switch (mod.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(d.level) || 1, 1), 4)
      return `<h${level}>${esc(String(d.text || ''))}</h${level}>`
    }

    case 'text': {
      // data.html is TipTap-generated structured HTML — render it directly
      // (iframe is sandboxed; DOMPurify sanitizes on the renderer/export side)
      if (d.html) return `<div class="text-body">${String(d.html)}</div>`
      // Fallback: plain text or markdown-ish content — escape it
      const content = String(d.content || d.text || '')
      return `<div class="text-body">${esc(content)}</div>`
    }

    case 'card': {
      const variant = d.variant ? ` card-${esc(String(d.variant))}` : ''
      const title = d.title ? `<h3>${esc(String(d.title))}</h3>` : ''
      const body = d.body || d.content || ''
      return `<div class="card${variant}">${title}<p>${esc(String(body))}</p></div>`
    }

    case 'label': {
      const color = d.color ? ` label-${esc(String(d.color))}` : ''
      return `<span class="label${color}">${esc(String(d.text || ''))}</span>`
    }

    case 'tip-box': {
      const title = d.title ? `<strong>${esc(String(d.title))}</strong>` : ''
      return `<div class="tip-box">${title}${esc(String(d.content || d.text || ''))}</div>`
    }

    case 'prompt-block': {
      const quality = d.quality ? ` prompt-${esc(String(d.quality))}` : ''
      return `<div class="prompt-block${quality}"><pre>${esc(String(d.content || d.text || ''))}</pre></div>`
    }

    case 'image': {
      const rawSrc = String(d.src || d.url || '')
      const src = rewriteImageSrc(rawSrc)
      const alt = esc(String(d.alt || ''))
      const caption = String(d.caption || '')
      let html = `<figure><img src="${esc(src)}" alt="${alt}" loading="lazy">`
      if (caption) html += `<figcaption>${esc(caption)}</figcaption>`
      html += `</figure>`
      return html
    }

    case 'carousel': {
      const items = Array.isArray(d.items) ? d.items : []
      if (items.length === 0) return '<div class="carousel"><p>No images</p></div>'
      // Show first image as static preview in the canvas
      const first = items[0] as Record<string, unknown>
      const src = rewriteImageSrc(String(first.src || ''))
      const alt = esc(String(first.alt || ''))
      return `<div class="carousel"><div class="carousel-track"><div class="carousel-item"><img src="${esc(src)}" alt="${alt}"></div></div></div>`
    }

    case 'comparison': {
      const panels = Array.isArray(d.panels) ? d.panels : []
      let html = '<div class="comparison">'
      for (const panel of panels) {
        const p = panel as Record<string, unknown>
        const title = p.title ? `<h3>${esc(String(p.title))}</h3>` : ''
        const body = esc(String(p.body || p.content || ''))
        html += `<div class="comparison-panel">${title}<p>${body}</p></div>`
      }
      html += '</div>'
      return html
    }

    case 'card-grid': {
      const cards = Array.isArray(d.cards) ? d.cards : []
      const cols = Number(d.columns || d.cols) || 3
      let html = `<div class="card-grid" style="grid-template-columns: repeat(${cols}, 1fr)">`
      for (const card of cards) {
        const c = card as Record<string, unknown>
        const title = c.title ? `<h3>${esc(String(c.title))}</h3>` : ''
        const body = esc(String(c.body || c.content || ''))
        const variant = c.variant ? ` card-${esc(String(c.variant))}` : ''
        html += `<div class="card${variant}">${title}<p>${body}</p></div>`
      }
      html += '</div>'
      return html
    }

    case 'flow': {
      const nodes = Array.isArray(d.nodes) ? d.nodes : []
      let html = '<div class="flow">'
      nodes.forEach((node: unknown, i: number) => {
        if (i > 0) html += '<div class="flow-arrow">\u2192</div>'
        html += `<div class="flow-node">${esc(String((node as Record<string, unknown>).label || node))}</div>`
      })
      html += '</div>'
      return html
    }

    case 'stream-list': {
      const items = Array.isArray(d.items) ? d.items : []
      let html = '<ul class="stream-list">'
      for (const item of items) {
        html += `<li>${esc(String((item as Record<string, unknown>).text || item))}</li>`
      }
      html += '</ul>'
      return html
    }

    case 'artifact': {
      const rawSrc = String(d.src || d.url || '')
      const src = /^https?:\/\//i.test(rawSrc) ? rawSrc : ''
      const width = String(d.width || '100%')
      const height = String(d.height || '400px')
      const alt = esc(String(d.alt || 'Interactive widget'))
      return `<div class="artifact-wrapper"><iframe src="${esc(src)}" width="${esc(width)}" height="${esc(height)}" style="border:none;border-radius:8px;" sandbox="allow-scripts" loading="lazy" title="${alt}"></iframe></div>`
    }

    case 'code': {
      const code = String(d.code || d.content || '')
      const lang = String(d.language || '')
      return `<div class="code-wrapper"><pre><code class="language-${esc(lang)}">${esc(code)}</code></pre></div>`
    }

    case 'quote': {
      const text = String(d.quote || d.text || '')
      const cite = String(d.cite || d.author || '')
      let html = `<blockquote><p>${esc(text)}</p>`
      if (cite) html += `<cite>${esc(cite)}</cite>`
      html += '</blockquote>'
      return html
    }

    default: {
      return `<div class="text-body">${esc(JSON.stringify(d))}</div>`
    }
  }
}

// ── Build Theme CSS Overrides ────────────────────────────────────────

function buildThemeCss(theme: Theme | null | undefined): string {
  if (!theme) return ''

  const bg = theme.colors?.bg ?? '#111827'
  const dark = isDark(bg)
  const text = dark ? '#f0f0f0' : '#1a1a2e'
  const textMuted = dark ? 'rgba(240,240,240,0.65)' : 'rgba(26,26,46,0.65)'
  const primary = theme.colors?.primary ?? '#1e3a5f'
  const secondary = theme.colors?.secondary ?? '#3b82f6'
  const accent = theme.colors?.accent ?? '#64b5f6'
  const headingFont = theme.fonts?.heading ?? 'Outfit'
  const bodyFont = theme.fonts?.body ?? 'Inter'
  const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'

  return `
    :root {
      --accent-cyan: ${accent};
      --accent-blue: ${secondary};
      --accent-navy: ${primary};
      --text-primary: ${text};
      --text-muted: ${textMuted};
      --border-subtle: ${border};
    }
    html, body {
      background: ${bg};
      color: ${text};
      font-family: '${bodyFont}', sans-serif;
    }
    h1, h2, h3, h4 {
      font-family: '${headingFont}', sans-serif;
    }
    .text-body { color: ${textMuted}; }
    .title-slide, .layout-divider, .closing-slide {
      background: ${primary};
    }
    .card {
      background: ${cardBg};
      border-color: ${border};
    }
    .card-cyan { border-left-color: ${accent}; }
    .card-navy { border-left-color: ${primary}; }
    .label-cyan { color: ${accent}; }
    .label-blue { color: ${secondary}; }
    .stream-list li { border-left-color: ${accent}; background: ${cardBg}; color: ${textMuted}; }
    .comparison-panel { background: ${cardBg}; border-color: ${border}; color: ${textMuted}; }
    .flow-node { background: ${cardBg}; border-color: ${border}; }
    .flow-arrow { color: ${textMuted}; }
    blockquote { border-left-color: ${accent}; }
    .tip-box strong { color: ${accent}; }
    figure figcaption { color: ${textMuted}; }
  `
}

// ── Public API ───────────────────────────────────────────────────────

export function renderSlideHtml(slide: Slide, theme: Theme | null | undefined): string {
  const layout = slide.layout || 'layout-content'
  const modules = [...slide.blocks].sort((a, b) => a.order - b.order)

  let bodyHtml: string

  if (layout === 'layout-split') {
    const contentMods = modules.filter((m) => m.zone === 'content')
    const stageMods = modules.filter((m) => m.zone === 'stage')
    const contentHtml = contentMods.map((m) => renderModule(m)).join('\n      ')
    const stageHtml = stageMods.map((m) => renderModule(m)).join('\n      ')

    bodyHtml = `
    <div class="slide ${esc(layout)}">
      <div class="content">
        ${contentHtml}
      </div>
      <div class="stage">
        ${stageHtml}
      </div>
    </div>`
  } else if (layout === 'title-slide' || layout === 'layout-divider' || layout === 'closing-slide') {
    // Hero/centered layouts — modules go in hero zone or fallback to all
    const heroMods = modules.filter((m) => m.zone === 'hero')
    const modsToRender = heroMods.length > 0 ? heroMods : modules
    const innerHtml = modsToRender.map((m) => renderModule(m)).join('\n    ')
    bodyHtml = `
    <div class="slide ${esc(layout)}">
      ${innerHtml}
    </div>`
  } else {
    // layout-content, layout-grid, layout-full-dark, etc.
    const mainMods = modules.filter((m) => m.zone === 'main')
    const modsToRender = mainMods.length > 0 ? mainMods : modules
    const innerHtml = modsToRender.map((m) => renderModule(m)).join('\n    ')
    bodyHtml = `
    <div class="slide ${esc(layout)}">
      ${innerHtml}
    </div>`
  }

  const themeCss = buildThemeCss(theme)

  // Build additional Google Fonts link for custom theme fonts
  const headingFont = theme?.fonts?.heading
  const bodyFont = theme?.fonts?.body
  const extraFonts: string[] = []
  if (headingFont && !['Inter', 'Outfit', 'JetBrains Mono'].includes(headingFont)) {
    extraFonts.push(headingFont.replace(/ /g, '+'))
  }
  if (bodyFont && bodyFont !== headingFont && !['Inter', 'Outfit', 'JetBrains Mono'].includes(bodyFont)) {
    extraFonts.push(bodyFont.replace(/ /g, '+'))
  }
  const extraFontLink = extraFonts.length > 0
    ? `\n  <link href="https://fonts.googleapis.com/css2?${extraFonts.map((f) => `family=${f}:wght@400;500;600;700`).join('&')}&display=swap" rel="stylesheet">`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${GOOGLE_FONTS_URL}" rel="stylesheet">${extraFontLink}
  <style>${FRAMEWORK_CSS}</style>
  <style>${themeCss}
    body { margin: 0; overflow: hidden; }
    .slide { display: flex; position: relative; width: 100%; height: 100vh; }
  </style>
</head>
<body>${bodyHtml}
</body>
</html>`
}
