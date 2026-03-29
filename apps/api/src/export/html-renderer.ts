import sanitizeHtml from 'sanitize-html'
import { NAVIGATION_JS } from './navigation.js'
import { CAROUSEL_JS } from './carousel.js'

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SAFE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'figure', 'figcaption', 'img', 'pre', 'code', 'span', 'br']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'loading'],
    a: ['href', 'target', 'rel'],
    code: ['class'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
}

function sanitize(html: string): string {
  return sanitizeHtml(html, SAFE_HTML_OPTIONS)
}

// ── Types ───────────────────────────────────────────────────────────

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
  modules: Module[]
}

interface ExportFile {
  id: string
  filename: string
  path: string
  mimeType: string
}

// ── Module Rendering ────────────────────────────────────────────────

function stepAttrs(mod: Module): string {
  if (mod.stepOrder != null) {
    return ` class="step-hidden" data-step="${mod.stepOrder}"`
  }
  return ''
}

function rewriteSrc(src: string, files?: ExportFile[]): string {
  if (src.includes('/api/decks/') && src.includes('/files/')) {
    const fileId = src.split('/files/').pop()
    const matched = files?.find(f => f.id === fileId)
    if (matched) return `assets/${matched.filename}`
  }
  return src
}

function renderModule(mod: Module, files?: ExportFile[]): string {
  const d = mod.data || {}
  const step = stepAttrs(mod)

  switch (mod.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(d.level) || 1, 1), 4)
      return `<h${level}${step}>${esc(String(d.text || ''))}</h${level}>`
    }

    case 'text': {
      const content = String(d.html || d.content || d.text || '')
      // If data.html exists, trust it as pre-rendered HTML; otherwise escape
      const body = d.html ? sanitize(content) : esc(content)
      const cls = mod.stepOrder != null ? 'text-body step-hidden' : 'text-body'
      const ds = mod.stepOrder != null ? ` data-step="${mod.stepOrder}"` : ''
      return `<div class="${cls}"${ds}>${body}</div>`
    }

    case 'card': {
      const variant = d.variant ? ` card-${esc(String(d.variant))}` : ''
      const title = d.title ? `<h3>${esc(String(d.title))}</h3>` : ''
      const raw = String(d.body || d.content || '')
      const body = (d.content && typeof d.content === 'string' && d.content.includes('<')) ? sanitize(raw) : esc(raw)
      return `<div class="card${variant}"${step}>${title}<p>${body}</p></div>`
    }

    case 'label': {
      const color = d.color ? ` label-${esc(String(d.color))}` : ''
      return `<span class="label${color}"${step}>${esc(String(d.text || ''))}</span>`
    }

    case 'tip-box': {
      const title = d.title ? `<strong>${esc(String(d.title))}</strong>` : ''
      const raw = String(d.content || d.text || '')
      const body = (d.content && typeof d.content === 'string' && d.content.includes('<')) ? sanitize(raw) : esc(raw)
      return `<div class="tip-box"${step}>${title}${body}</div>`
    }

    case 'prompt-block': {
      const quality = d.quality ? ` prompt-${esc(String(d.quality))}` : ''
      return `<div class="prompt-block${quality}"${step}><pre>${esc(String(d.content || d.text || ''))}</pre></div>`
    }

    case 'image': {
      const src = rewriteSrc(String(d.src || d.url || ''), files)
      const alt = esc(String(d.alt || ''))
      const caption = String(d.caption || '')
      let html = `<figure${step}><img src="${esc(src)}" alt="${alt}" loading="lazy">`
      if (caption) html += `<figcaption>${esc(caption)}</figcaption>`
      html += `</figure>`
      return html
    }

    case 'carousel': {
      const items = Array.isArray(d.items) ? d.items : []
      const syncAttr = d.syncSteps ? ' data-sync-steps' : ''
      const intervalAttr = d.interval ? ` data-interval="${esc(String(d.interval))}"` : ''
      let html = `<div class="carousel"${syncAttr}${intervalAttr}${step}>`
      html += `<button class="carousel-prev" aria-label="Previous">&lsaquo;</button>`
      html += `<div class="carousel-track">`
      for (const item of items) {
        const src = rewriteSrc(String((item as Record<string, unknown>).src || ''), files)
        const alt = esc(String((item as Record<string, unknown>).alt || ''))
        html += `<div class="carousel-item"><img src="${esc(src)}" alt="${alt}"></div>`
      }
      html += `</div>`
      html += `<button class="carousel-next" aria-label="Next">&rsaquo;</button>`
      html += `<div class="carousel-dots">`
      items.forEach((_: unknown, i: number) => {
        html += `<button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Go to image ${i + 1}"></button>`
      })
      html += `</div></div>`
      return html
    }

    case 'comparison': {
      const panels = Array.isArray(d.panels) ? d.panels : []
      let html = `<div class="comparison"${step}>`
      for (const panel of panels) {
        const p = panel as Record<string, unknown>
        const title = p.title ? `<h3>${esc(String(p.title))}</h3>` : ''
        const body = esc(String(p.body || p.content || ''))
        html += `<div class="comparison-panel">${title}<p>${body}</p></div>`
      }
      html += `</div>`
      return html
    }

    case 'card-grid': {
      const cards = Array.isArray(d.cards) ? d.cards : []
      const cols = Number(d.columns || d.cols) || 3
      let html = `<div class="card-grid" style="grid-template-columns: repeat(${cols}, 1fr)"${step}>`
      for (const card of cards) {
        const c = card as Record<string, unknown>
        const title = c.title ? `<h3>${esc(String(c.title))}</h3>` : ''
        const body = esc(String(c.body || c.content || ''))
        const variant = c.variant ? ` card-${esc(String(c.variant))}` : ''
        html += `<div class="card${variant}">${title}<p>${body}</p></div>`
      }
      html += `</div>`
      return html
    }

    case 'flow': {
      const nodes = Array.isArray(d.nodes) ? d.nodes : []
      let html = `<div class="flow"${step}>`
      nodes.forEach((node: unknown, i: number) => {
        if (i > 0) html += `<div class="flow-arrow">→</div>`
        html += `<div class="flow-node">${esc(String((node as Record<string, unknown>).label || node))}</div>`
      })
      html += `</div>`
      return html
    }

    case 'stream-list': {
      const items = Array.isArray(d.items) ? d.items : []
      let html = `<ul class="stream-list"${step}>`
      for (const item of items) {
        html += `<li>${esc(String((item as Record<string, unknown>).text || item))}</li>`
      }
      html += `</ul>`
      return html
    }

    case 'artifact': {
      const rawSrc = String(d.src || d.url || '')
      const src = /^https?:\/\//i.test(rawSrc) ? rawSrc : ''
      const width = String(d.width || '100%')
      const height = String(d.height || '400px')
      const alt = esc(String(d.alt || 'Interactive visualization'))
      return `<div class="artifact-wrapper"${step}><iframe src="${esc(src)}" width="${esc(width)}" height="${esc(height)}" style="border:none;border-radius:8px;" sandbox="allow-scripts" loading="lazy" title="${alt}"></iframe></div>`
    }

    case 'code': {
      const code = String(d.code || d.content || '')
      const lang = String(d.language || '')
      return `<div class="code-wrapper"${step}><pre><code class="language-${esc(lang)}">${esc(code)}</code></pre></div>`
    }

    case 'quote': {
      const text = String(d.quote || d.text || '')
      const cite = String(d.cite || d.author || '')
      let html = `<blockquote${step}><p>${esc(text)}</p>`
      if (cite) html += `<cite>${esc(cite)}</cite>`
      html += `</blockquote>`
      return html
    }

    default: {
      return `<div class="text-body"${step}>${esc(JSON.stringify(d))}</div>`
    }
  }
}

// ── Slide Rendering ─────────────────────────────────────────────────

function renderSlide(slide: Slide, index: number, files?: ExportFile[]): string {
  const layout = slide.layout || 'layout-content'
  const modules = [...slide.modules].sort((a, b) => a.order - b.order)
  const title = modules.find(m => m.type === 'heading')
  const titleText = title ? String(title.data.text || '') : `Slide ${index + 1}`

  const attrs = `class="slide ${esc(layout)}"${index === 0 ? '' : ''} role="group" aria-roledescription="slide" aria-label="Slide ${index + 1}: ${esc(titleText)}"`

  if (layout === 'layout-split') {
    const contentMods = modules.filter(m => m.zone === 'content')
    const stageMods = modules.filter(m => m.zone === 'stage')
    const contentHtml = contentMods.map(m => renderModule(m, files)).join('\n      ')
    const stageHtml = stageMods.map(m => renderModule(m, files)).join('\n      ')

    return `  <div ${attrs}>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="stage">
      ${stageHtml}
    </div>
  </div>`
  }

  // All other layouts: render modules in order (ignore zone distinction)
  const body = modules.map(m => renderModule(m, files)).join('\n    ')
  return `  <div ${attrs}>
    ${body}
  </div>`
}

// ── Public API ──────────────────────────────────────────────────────

export function renderDeckHtml(
  deckName: string,
  slideList: Slide[],
  theme: any,
  files?: ExportFile[],
): string {
  const sorted = [...slideList].sort((a, b) => a.order - b.order)
  const slidesHtml = sorted.map((s, i) => renderSlide(s, i, files)).join('\n\n')
  const slideCount = sorted.length
  const title = esc(deckName)

  // Generate theme CSS overrides — re-validate at render time (defense-in-depth)
  const hexColorRegex = /^#[0-9a-fA-F]{3,8}$/
  const fontNameRegex = /^[a-zA-Z0-9 \-]+$/
  function safeColor(val: unknown, fallback: string): string {
    return typeof val === 'string' && hexColorRegex.test(val) ? val : fallback
  }
  function safeFont(val: unknown, fallback: string): string {
    return typeof val === 'string' && fontNameRegex.test(val) ? val : fallback
  }

  const colors = theme?.colors ?? {}
  const fonts = theme?.fonts ?? {}
  const bg = safeColor(colors.bg, '#111827')
  const primary = safeColor(colors.primary, '#1e3a5f')
  const secondary = safeColor(colors.secondary, '#3b82f6')
  const accent = safeColor(colors.accent, '#64b5f6')
  const headingFont = safeFont(fonts.heading, 'Outfit')
  const bodyFont = safeFont(fonts.body, 'Inter')

  // Detect dark/light
  function lum(hex: string): number {
    if (!hex || hex.length < 7) return 0
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return r * 0.299 + g * 0.587 + b * 0.114
  }
  const isDarkBg = lum(bg) < 128
  const isDarkPrimary = lum(primary) < 128
  const text = isDarkBg ? '#f0f0f0' : '#1a1a2e'
  const textMuted = isDarkBg ? 'rgba(240,240,240,0.65)' : 'rgba(26,26,46,0.65)'
  const primaryText = isDarkPrimary ? '#ffffff' : '#1a1a2e'
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'

  const themeCss = `
    :root {
      --theme-bg: ${bg};
      --theme-text: ${text};
      --theme-text-muted: ${textMuted};
      --theme-primary: ${primary};
      --theme-primary-text: ${primaryText};
      --theme-secondary: ${secondary};
      --theme-accent: ${accent};
      --theme-heading-font: '${headingFont}';
      --theme-body-font: '${bodyFont}';
      --theme-card-bg: ${cardBg};
      --theme-border: ${border};
    }
    html, body { background: ${bg}; color: ${text}; font-family: '${bodyFont}', sans-serif; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    .title-slide, .layout-divider, .closing-slide { background: ${primary}; color: ${primaryText}; }
    .card { background: ${cardBg}; border-color: ${border}; }
    .card-cyan { border-left-color: ${accent}; }
    .label-cyan { background: ${accent}1a; color: ${accent}; }
    .label-blue { background: ${secondary}1a; color: ${secondary}; }
    .tip-box { background: ${accent}0d; border-color: ${accent}1f; }
    .tip-box strong { color: ${accent}; }
    .stream-list li { border-left-color: ${accent}; background: ${cardBg}; color: ${textMuted}; }
    .text-body { color: ${textMuted}; }
    .comparison-panel { background: ${cardBg}; border-color: ${border}; }
    .flow-node { background: ${cardBg}; border-color: ${border}; }
  `

  // Include fonts from theme
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(bodyFont)}:wght@400;500;600;700&family=${encodeURIComponent(headingFont)}:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="${fontUrl}" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <style>${themeCss}</style>
</head>
<body>
  <a href="#deck" class="skip-link">Skip to slides</a>
  <div aria-live="polite" class="sr-only" id="announcer"></div>

  <div id="deck">
${slidesHtml}
  </div>

  <nav id="nav-bar">
    <button id="prev-btn" aria-label="Previous">&larr;</button>
    <input type="range" id="scrubber" min="0" max="${slideCount - 1}" value="0" aria-label="Slide progress">
    <span id="slide-counter">1 / ${slideCount}</span>
    <button id="next-btn" aria-label="Next">&rarr;</button>
  </nav>

  <script>
${NAVIGATION_JS}
  </script>
  <script>
${CAROUSEL_JS}
  </script>
</body>
</html>`
}
