import sanitizeHtml from 'sanitize-html'
import { NAVIGATION_JS } from './navigation.js'
import { CAROUSEL_JS } from './carousel.js'
import { ARTIFACTS_JS, NATIVE_ARTIFACT_NAMES } from './artifacts.js'
import {
  buildFontSizeAttr,
  containsHtmlMarkup,
  escapeHtml,
  getSlideSections,
  getSlideTitle,
  renderFormattedContent,
  renderRichTextData,
} from '@slide-maker/shared'

function esc(str: string): string {
  return escapeHtml(str)
}

const SAFE_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'figure', 'figcaption', 'img', 'pre', 'code', 'span', 'br']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'loading'],
    a: ['href', 'target', 'rel'],
    code: ['class'],
    span: ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedStyles: {
    span: {
      'font-size': [/^\d+(?:px|em|rem|%)$/],
    },
  },
}

function sanitize(html: string): string {
  return sanitizeHtml(html, SAFE_HTML_OPTIONS)
}

/** Simple markdown → HTML for text fallback when data.html is absent */
function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  let listType = ''

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    const numberedMatch = line.match(/^\d+\.\s+(.+)/)

    if (headingMatch) {
      if (inList) {
        out.push(listType === 'ol' ? '</ol>' : '</ul>')
        inList = false
        listType = ''
      }
      const level = headingMatch[1].length
      out.push(`<h${level}>${inlineMd(headingMatch[2])}</h${level}>`)
    } else if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
        out.push('<ul>')
        inList = true
        listType = 'ul'
      }
      out.push(`<li>${inlineMd(bulletMatch[1])}</li>`)
    } else if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
        out.push('<ol>')
        inList = true
        listType = 'ol'
      }
      out.push(`<li>${inlineMd(numberedMatch[1])}</li>`)
    } else {
      if (inList) {
        out.push(listType === 'ol' ? '</ol>' : '</ul>')
        inList = false
        listType = ''
      }
      if (line.trim() === '') out.push('<br>')
      else out.push(`<p>${inlineMd(line)}</p>`)
    }
  }
  if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
  return out.join('\n')
}

function inlineMd(text: string): string {
  let html = esc(text)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safe = /^https?:\/\//i.test(url) ? url : '#'
    return `<a href="${safe}" target="_blank" rel="noopener">${label}</a>`
  })
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  return html
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
    if (matched) {
      const extMatch = matched.filename.match(/(\.[^./]+)$/)
      const ext = extMatch ? extMatch[1] : ''
      return `assets/${matched.id}${ext}`
    }
  }
  return src
}

interface RenderOptions {
  extractArtifacts?: boolean
  externalJs?: boolean // when true, reference js/engine.js instead of inlining
  // When provided, inline artifact HTML will be served via this endpoint as
  // `/path?b64=<base64(html)>`, which preserves a proper Referer header.
  artifactEndpoint?: string
  // Thumbnail/preview flags — allow callers to strip heavier chrome
  omitNav?: boolean
  omitScripts?: boolean
  omitFonts?: boolean
}

const extractedArtifacts: Map<string, string> = new Map()

export function getExtractedArtifacts(): Map<string, string> {
  return new Map(extractedArtifacts)
}

export function clearExtractedArtifacts(): void {
  extractedArtifacts.clear()
}

function renderModule(mod: Module, files?: ExportFile[], opts?: RenderOptions): string {
  const d = mod.data || {}
  const step = stepAttrs(mod)

  switch (mod.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(d.level) || 1, 1), 4)
      const extra = d.align ? [`text-align: ${esc(String(d.align))}`] : []
      const styleAttr = buildFontSizeAttr(d.fontSize, esc, extra)
      const raw = String(d.text || '')
      const inner = containsHtmlMarkup(raw)
        ? sanitize(raw).replace(/<\/?p>/g, '').trim()
        : esc(raw)
      return `<h${level}${step}${styleAttr}>${inner}</h${level}>`
    }

    case 'text': {
      const cls = mod.stepOrder != null ? 'text-body step-hidden' : 'text-body'
      const ds = mod.stepOrder != null ? ` data-step="${mod.stepOrder}"` : ''
      const styleAttr = buildFontSizeAttr(d.fontSize, esc)
      const html = renderRichTextData(d, sanitize)
      return html ? `<div class="${cls}"${ds}${styleAttr}>${html}</div>` : ''
    }

    case 'card': {
      const variant = d.variant ? ` card-${esc(String(d.variant))}` : ''
      const title = d.title ? `<h3>${esc(String(d.title))}</h3>` : ''
      const raw = String(d.body || d.content || '')
      const body = renderFormattedContent(raw, sanitize)
      const bodyHtml = containsHtmlMarkup(raw) ? body : `<p>${body}</p>`
      const cStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="card${variant}"${step}${cStyleAttr}>${title}${bodyHtml}</div>`
    }

    case 'label': {
      const color = d.color ? ` label-${esc(String(d.color))}` : ''
      const raw = String(d.text || '')
      const inner = containsHtmlMarkup(raw)
        ? sanitize(raw).replace(/<\/?p>/g, '').trim()
        : esc(raw)
      const lStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<span class="label${color}"${step}${lStyleAttr}>${inner}</span>`
    }

    case 'tip-box': {
      const title = d.title ? `<strong>${esc(String(d.title))}</strong>` : ''
      const raw = String(d.content || d.text || '')
      const body = renderFormattedContent(raw, sanitize)
      const tbStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="tip-box"${step}${tbStyleAttr}>${title}<div class="tip-box-content">${body}</div></div>`
    }

    case 'prompt-block': {
      const quality = d.quality ? ` prompt-${esc(String(d.quality))}` : ''
      const pbStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="prompt-block${quality}"${step}${pbStyleAttr}><pre>${esc(String(d.content || d.text || ''))}</pre></div>`
    }

    case 'image': {
      const src = rewriteSrc(String(d.src || d.url || ''), files)
      const alt = esc(String(d.alt || ''))
      const caption = String(d.caption || '')
      const imgW = typeof d.width === 'string' ? d.width : ''
      const imgH = typeof d.height === 'string' ? d.height : ''
      const sizeAttr = imgW || imgH ? ` style="${imgW ? `width:${esc(imgW)};` : ''}${imgH ? `max-height:${esc(imgH)};` : ''}object-fit:contain;"` : ''
      let html = `<figure${step}><img src="${esc(src)}" alt="${alt}" loading="lazy"${sizeAttr}>`
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
      const cpStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<div class="comparison"${step}${cpStyleAttr}>`
      for (const panel of panels) {
        const p = panel as Record<string, unknown>
        const title = p.title ? `<h3>${esc(String(p.title))}</h3>` : ''
        const raw = String(p.body || p.content || '')
        const body = renderFormattedContent(raw, sanitize)
        const bodyHtml = containsHtmlMarkup(raw) ? body : `<p>${body}</p>`
        html += `<div class="comparison-panel">${title}<div class="panel-content">${bodyHtml}</div></div>`
      }
      html += `</div>`
      return html
    }

    case 'card-grid': {
      const cards = Array.isArray(d.cards) ? d.cards : []
      const cols = Number(d.columns || d.cols) || 3
      const cgExtra = d.fontSize ? `; font-size: ${esc(String(d.fontSize))}` : ''
      let html = `<div class="card-grid" style="grid-template-columns: repeat(${cols}, 1fr)${cgExtra}"${step}>`
      for (const card of cards) {
        const c = card as Record<string, unknown>
        const title = c.title ? `<h3 class="card-title">${esc(String(c.title))}</h3>` : ''
        const raw = String(c.body || c.content || '')
        const body = raw.includes('<') ? sanitize(raw) : markdownToHtml(raw)
        const variant = c.variant ? ` card-${esc(String(c.variant))}` : ''
        const color = typeof c.color === 'string' && c.color && !c.variant ? ` style="border-top:3px solid ${esc(c.color)}"` : ''
        const bodyHtml = body ? `<div class="card-content">${body}</div>` : ''
        html += `<div class="card${variant}"${color}>${title}${bodyHtml}</div>`
      }
      html += `</div>`
      return html
    }

    case 'flow': {
      const nodes = Array.isArray(d.nodes) ? d.nodes : []
      const fStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<div class="flow"${step}${fStyleAttr}>`
      nodes.forEach((node: unknown, i: number) => {
        if (i > 0) html += `<div class="flow-arrow"></div>`
        const n = node as Record<string, unknown>
        const icon = typeof n.icon === 'string' ? n.icon : String(i + 1)
        const label = sanitize(String(n.label || ''))
        const desc = typeof n.description === 'string' ? `<div class="flow-desc">${sanitize(n.description)}</div>` : ''
        html += `<div class="flow-node"><div class="flow-icon">${esc(icon)}</div><div class="flow-body"><div class="flow-label">${label}</div>${desc}</div></div>`
      })
      html += `</div>`
      return html
    }

    case 'video': {
      const rawUrl = String(d.url || '')
      const caption = String(d.caption || '')
      let embedSrc = ''
      try {
        const u = new URL(rawUrl)
        if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
          let vid = ''
          if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1)
          else if (u.pathname.startsWith('/embed/')) vid = u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || ''
          else vid = u.searchParams.get('v') || ''
          if (vid) embedSrc = `https://www.youtube.com/embed/${vid}`
        } else if (u.hostname.includes('vimeo.com')) {
          const vId = u.pathname.split('/').filter(Boolean)[0]
          if (vId && /^\d+$/.test(vId)) embedSrc = `https://player.vimeo.com/video/${vId}`
        } else if (u.hostname.includes('loom.com') && u.pathname.startsWith('/share/')) {
          const lId = u.pathname.split('/share/')[1]?.split(/[?/]/)[0] || ''
          if (lId) embedSrc = `https://www.loom.com/embed/${lId}`
        } else if (u.pathname.includes('/embed')) {
          embedSrc = rawUrl
        }
      } catch {}
      if (!embedSrc) return ''
      let html = `<div class="video-wrapper"${step}>`
      html += `<div class="video-frame"><iframe src="${esc(embedSrc)}" title="${esc(caption || 'Embedded video')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
      if (caption) html += `<p class="video-caption">${esc(caption)}</p>`
      html += `</div>`
      return html
    }

    case 'stream-list': {
      const items = Array.isArray(d.items) ? d.items : []
      const slStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<ul class="stream-list"${step}${slStyleAttr}>`
      for (const item of items) {
        const o = item as Record<string, unknown>
        const text = typeof item === 'string' ? item : String(o.text || o.content || o.label || o.title || JSON.stringify(item))
        const inner = containsHtmlMarkup(text)
          ? sanitize(text).replace(/^<p>(.*)<\/p>$/s, '$1')
          : inlineMd(text)
        html += `<li>${inner}</li>`
      }
      html += `</ul>`
      return html
    }

    case 'artifact': {
      const rawSrc = String(d.src || d.url || '')
      const rawSource = d.rawSource ? String(d.rawSource) : ''
      const isUrl = /^https?:\/\//i.test(rawSrc)
      const artifactName = d.artifactName ? String(d.artifactName) : ''
      const alt = esc(String(d.alt || 'Interactive visualization'))
      const aw = d.width ? String(d.width) : ''
      const ah = d.height ? String(d.height) : ''
      const autoSize = d.autoSize !== false
      const ar = Number(d.aspectRatio)
      const hasAr = isFinite(ar) && ar > 0
      const align = typeof d.align === 'string' ? String(d.align) : 'center'
      const alignCss = align === 'left' ? 'margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : 'margin:0 auto;'
      const arStyle = !ah && autoSize && hasAr ? `aspect-ratio:${ar};` : ''
      const sizeStyle = ` style="${aw ? `width:${esc(aw)};` : ''}${ah ? `height:${esc(ah)};aspect-ratio:auto;` : arStyle}${alignCss}"`
      const wrapArtifact = (content: string) => `<div class="artifact-wrapper"${step}${sizeStyle}>${content}</div>`

      // Native JS rendering for registered canvas artifacts (no iframe)
      const nativeName = artifactName || String(d.alt || '')
      if (nativeName && NATIVE_ARTIFACT_NAMES.has(nativeName)) {
        const configJson = d.config ? esc(JSON.stringify(d.config)) : '{}'
        return wrapArtifact(`<div class="artifact-native" data-artifact="${esc(nativeName)}" data-config="${configJson}"></div>`)
      }

      // Iframe fallback for external URLs, HTML-source artifacts (charts, maps, etc.)
      if (isUrl) {
        return wrapArtifact(`<iframe src="${esc(rawSrc)}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`)
      }
      if (rawSource && opts?.extractArtifacts) {
        const hash = Buffer.from(rawSource).toString('base64url').slice(0, 12)
        const filename = `artifact-${hash}.html`
        extractedArtifacts.set(filename, rawSource)
        return wrapArtifact(`<iframe src="artifacts/${filename}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`)
      }
      if (rawSource && opts?.artifactEndpoint) {
        const b64 = Buffer.from(rawSource, 'utf8').toString('base64')
        const ep = opts.artifactEndpoint.endsWith('/') ? opts.artifactEndpoint.slice(0, -1) : opts.artifactEndpoint
        return wrapArtifact(`<iframe src="${esc(ep)}?b64=${esc(encodeURIComponent(b64))}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`)
      }
      if (rawSource) {
        return wrapArtifact(`<iframe srcdoc="${esc(rawSource)}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`)
      }
      return `<div class="artifact-wrapper"${step} style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">${alt}</div>`
    }

    default: {
      return `<div class="text-body"${step}>${esc(JSON.stringify(d))}</div>`
    }
  }
}

// ── Slide Rendering ─────────────────────────────────────────────────

function renderSlide(slide: Slide, index: number, files?: ExportFile[], opts?: RenderOptions): string {
  const sections = getSlideSections(slide)
  const layout = sections.layout
  const titleText = getSlideTitle(sections.modules, index)

  const attrs = `class="slide ${esc(layout)}"${index === 0 ? '' : ''} role="group" aria-roledescription="slide" aria-label="Slide ${index + 1}: ${esc(titleText)}"`

  if (layout === 'layout-split') {
    const contentHtml = sections.contentModules.map(m => renderModule(m, files, opts)).join('\n      ')
    const stageHtml = sections.stageModules.map(m => renderModule(m, files, opts)).join('\n      ')
    const contentFlex = sections.splitRatio
    const stageFlex = 1 - sections.splitRatio

    return `  <div ${attrs}>
    <div class="content" style="flex: ${contentFlex}">
      ${contentHtml}
    </div>
    <div class="stage" style="flex: ${stageFlex}">
      ${stageHtml}
    </div>
  </div>`
  }

  const body = sections.primaryModules.map(m => renderModule(m, files, opts)).join('\n      ')
  return `  <div ${attrs}>
    <div class="${sections.primaryWrapperClass}">
      ${body}
    </div>
  </div>`
}

// ── Public API ──────────────────────────────────────────────────────

export function renderDeckHtml(
  deckName: string,
  slideList: Slide[],
  theme: any,
  files?: ExportFile[],
  opts?: RenderOptions,
): string {
  const sorted = [...slideList].sort((a, b) => a.order - b.order)
  const slidesHtml = sorted.map((s, i) => renderSlide(s, i, files, opts)).join('\n\n')
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
  const primaryTextMuted = isDarkPrimary ? 'rgba(255,255,255,0.85)' : 'rgba(26,26,46,0.7)'
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const splitBg = isDarkBg ? '#172a45' : '#e8eef6'
  const gridBg = isDarkBg ? '#0f3444' : '#e9f5f7'

  const themeCss = `
    :root {
      --theme-bg: ${bg};
      --theme-text: ${text};
      --theme-text-muted: ${textMuted};
      --theme-primary: ${primary};
      --theme-primary-text: ${primaryText};
      --theme-primary-text-muted: ${primaryTextMuted};
      --theme-secondary: ${secondary};
      --theme-accent: ${accent};
      --theme-heading-font: '${headingFont}';
      --theme-body-font: '${bodyFont}';
      --theme-card-bg: ${cardBg};
      --theme-border: ${border};
      --layout-split-bg: ${splitBg};
      --layout-grid-bg: ${gridBg};
      --text-muted: ${textMuted};
      --text-primary: ${text};
    }
    html, body { background: ${bg}; color: ${text}; font-family: '${bodyFont}', sans-serif; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    /* Ensure dark layout uses light text regardless of global theme */
    .layout-full-dark {
      --text-muted: rgba(240,240,240,0.65);
      --text-primary: #f0f0f0;
      color: #f0f0f0;
    }
    .title-slide, .layout-divider, .closing-slide {
      background: ${primary}; color: ${primaryText};
      --theme-text: ${primaryText};
      --theme-text-muted: ${primaryTextMuted};
      --theme-card-bg: rgba(255,255,255,0.06);
      --theme-border: rgba(255,255,255,0.12);
      --text-muted: ${primaryTextMuted};
      --text-primary: ${primaryText};
    }
    .card { background: ${cardBg}; border-color: ${border}; }
    .card-cyan { border-left-color: ${accent}; }
    .label-cyan { color: ${accent}; }
    .label-blue { color: ${secondary}; }
    .tip-box { background: ${accent}0d; border-color: ${accent}1f; }
    .tip-box strong { color: ${accent}; }
    /* Text colors use var() so title-slide/divider/closing-slide
       --text-muted/--text-primary overrides cascade correctly. */
    .stream-list li { border-left-color: ${accent}; background: ${cardBg}; color: var(--text-muted); }
    .comparison-panel { background: ${cardBg}; border-color: ${border}; }
    .flow-node { background: ${cardBg}; border-color: ${border}; }
    .prompt-block { color: var(--text-primary); }
    blockquote { color: var(--text-primary); }
  `

  // Include fonts from theme
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(bodyFont)}:wght@400;500;600;700&family=${encodeURIComponent(headingFont)}:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap`

  const engineScripts = opts?.omitScripts
    ? ''
    : (opts?.externalJs
        ? '<script src="js/engine.js"></script>\n  <script src="js/artifacts.js"></script>'
        : `<script>\n${NAVIGATION_JS}\n  </script>\n  <script>\n${CAROUSEL_JS}\n  </script>\n  <script>\n${ARTIFACTS_JS}\n  </script>`)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${opts?.omitFonts ? '' : `<link href="${fontUrl}" rel="stylesheet">`}
  <link rel="stylesheet" href="css/styles.css">
  <style>${themeCss}</style>
</head>
<body>
  <a href="#deck" class="skip-link">Skip to slides</a>
  <div aria-live="polite" class="sr-only" id="announcer"></div>

  <div id="deck">
${slidesHtml}
  </div>
  ${opts?.omitNav ? '' : `
  <nav id="nav-bar">
    <button id="prev-btn" aria-label="Previous">&larr;</button>
    <input type="range" id="scrubber" min="0" max="${slideCount - 1}" value="0" aria-label="Slide progress">
    <span id="slide-counter">1 / ${slideCount}</span>
    <button id="next-btn" aria-label="Next">&rarr;</button>
  </nav>`}

  ${engineScripts}
</body>
</html>`
}

export { renderModule }
