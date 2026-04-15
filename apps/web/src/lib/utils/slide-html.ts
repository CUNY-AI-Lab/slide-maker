/**
 * Client-side slide HTML renderer for iframe srcdoc preview.
 * Mirrors the logic in apps/api/src/export/html-renderer.ts
 * but renders a SINGLE slide into a complete HTML document.
 */

import DOMPurify from 'dompurify'
import { API_URL } from '$lib/api'
import { FRAMEWORK_CSS } from './framework-css-client'
import { buildSourceWithConfig } from './artifact-config'
import { isDark, darkenHex } from '$lib/stores/themes'
import {
  buildFontSizeAttr,
  buildInlineArtifactSrcdoc,
  containsHtmlMarkup,
  escapeHtml,
  getSlideSections,
  renderFormattedContent,
  renderRichTextData,
} from '@slide-maker/shared'

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'

function esc(str: string): string {
  return escapeHtml(str)
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html)
}

function rewriteAssetSrc(src: string): string {
  if (src.startsWith('/api/')) return `${API_URL}${src}`
  return src
}

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

function renderModule(mod: Module, slide: Slide): string {
  const d = mod.data || {}

  switch (mod.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(d.level) || 1, 1), 4)
      const raw = String(d.text || '')
      const inner = containsHtmlMarkup(raw)
        ? sanitize(raw).replace(/^<p>(.*)<\/p>$/s, '$1')
        : esc(raw)
      return `<h${level}>${inner}</h${level}>`
    }

    case 'text': {
      const styleAttr = buildFontSizeAttr(d.fontSize, esc)
      const html = renderRichTextData(d, sanitize)
      return html ? `<div class="text-body"${styleAttr}>${html}</div>` : ''
    }

    case 'card': {
      const variant = d.variant ? ` card-${esc(String(d.variant))}` : ''
      const title = d.title ? `<h3>${esc(String(d.title))}</h3>` : ''
      const raw = String(d.body || d.content || '')
      const body = renderFormattedContent(raw, sanitize)
      const bodyHtml = containsHtmlMarkup(raw) ? body : `<p>${body}</p>`
      const cStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="card${variant}"${cStyleAttr}>${title}${bodyHtml}</div>`
    }

    case 'label': {
      const color = d.color ? ` label-${esc(String(d.color))}` : ''
      const raw = String(d.text || '')
      const inner = containsHtmlMarkup(raw)
        ? sanitize(raw).replace(/^<p>(.*)<\/p>$/s, '$1')
        : esc(raw)
      const lStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<span class="label${color}"${lStyleAttr}>${inner}</span>`
    }

    case 'tip-box': {
      const title = d.title ? `<strong>${esc(String(d.title))}</strong>` : ''
      const raw = String(d.content || d.text || '')
      const body = renderFormattedContent(raw, sanitize)
      const tbStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="tip-box"${tbStyleAttr}>${title}${body}</div>`
    }

    case 'prompt-block': {
      const quality = d.quality ? ` prompt-${esc(String(d.quality))}` : ''
      const pbStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      return `<div class="prompt-block${quality}"${pbStyleAttr}><pre>${esc(String(d.content || d.text || ''))}</pre></div>`
    }

    case 'image': {
      const src = rewriteAssetSrc(String(d.src || d.url || ''))
      const alt = esc(String(d.alt || ''))
      const caption = String(d.caption || '')
      const imgW = typeof d.width === 'string' ? d.width : ''
      const imgH = typeof d.height === 'string' ? d.height : ''
      const sizeAttr = imgW || imgH ? ` style="${imgW ? `width:${esc(imgW)};` : ''}${imgH ? `max-height:${esc(imgH)};` : ''}object-fit:contain;"` : ''
      let html = `<figure><img src="${esc(src)}" alt="${alt}" loading="lazy"${sizeAttr}>`
      if (caption) html += `<figcaption>${esc(caption)}</figcaption>`
      html += `</figure>`
      return html
    }

    case 'carousel': {
      const items = Array.isArray(d.items) ? d.items : []
      if (items.length === 0) return '<div class="carousel"><p>No images</p></div>'
      const first = items[0] as Record<string, unknown>
      const src = rewriteAssetSrc(String(first.src || ''))
      const alt = esc(String(first.alt || ''))
      return `<div class="carousel"><div class="carousel-track"><div class="carousel-item"><img src="${esc(src)}" alt="${alt}"></div></div></div>`
    }

    case 'comparison': {
      const panels = Array.isArray(d.panels) ? d.panels : []
      const cpStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<div class="comparison"${cpStyleAttr}>`
      for (const panel of panels) {
        const item = panel as Record<string, unknown>
        const title = item.title ? `<h3>${esc(String(item.title))}</h3>` : ''
        const raw = String(item.body || item.content || '')
        const body = renderFormattedContent(raw, sanitize)
        const bodyHtml = containsHtmlMarkup(raw) ? body : `<p>${body}</p>`
        html += `<div class="comparison-panel">${title}${bodyHtml}</div>`
      }
      html += '</div>'
      return html
    }

    case 'card-grid': {
      const cards = Array.isArray(d.cards) ? d.cards : []
      const cols = Number(d.columns || d.cols) || 3
      const cgExtra = d.fontSize ? `; font-size: ${esc(String(d.fontSize))}` : ''
      let html = `<div class="card-grid" style="grid-template-columns: repeat(${cols}, 1fr)${cgExtra}">`
      for (const card of cards) {
        const item = card as Record<string, unknown>
        const title = item.title ? `<h3>${esc(String(item.title))}</h3>` : ''
        const raw = String(item.body || item.content || '')
        const body = renderFormattedContent(raw, sanitize)
        const bodyHtml = containsHtmlMarkup(raw) ? body : `<p>${body}</p>`
        const variant = item.variant ? ` card-${esc(String(item.variant))}` : ''
        const color = typeof item.color === 'string' && item.color ? ` style="border-top:3px solid ${esc(item.color)}"` : ''
        html += `<div class="card${variant}"${color}>${title}${bodyHtml}</div>`
      }
      html += '</div>'
      return html
    }

    case 'flow': {
      const nodes = Array.isArray(d.nodes) ? d.nodes : []
      const fStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<div class="flow"${fStyleAttr}>`
      nodes.forEach((node: unknown, index: number) => {
        if (index > 0) html += '<div class="flow-arrow">→</div>'
        html += `<div class="flow-node">${esc(String((node as Record<string, unknown>).label || node))}</div>`
      })
      html += '</div>'
      return html
    }

    case 'stream-list': {
      const items = Array.isArray(d.items) ? d.items : []
      const slStyleAttr = buildFontSizeAttr(d.fontSize, esc)
      let html = `<ul class="stream-list"${slStyleAttr}>`
      for (const item of items) {
        const o = typeof item === 'object' && item ? item as Record<string, unknown> : null
        const text = o ? String(o.text || o.content || o.label || o.title || JSON.stringify(item)) : String(item)
        html += `<li>${esc(text)}</li>`
      }
      html += '</ul>'
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
      let html = '<div class="video-wrapper">'
      html += `<div class="video-frame"><iframe src="${esc(embedSrc)}" title="${esc(caption || 'Embedded video')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
      if (caption) html += `<p class="video-caption">${esc(caption)}</p>`
      html += '</div>'
      return html
    }

    case 'artifact': {
      const rawSource = typeof d.rawSource === 'string' ? d.rawSource : ''
      const rawSrc = String(d.src || d.url || '')
      const alt = esc(String(d.alt || 'Interactive visualization'))
      const width = d.width ? String(d.width) : ''
      const height = d.height ? String(d.height) : ''
      const autoSize = d.autoSize !== false
      const aspectRatio = Number(d.aspectRatio)
      const hasAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
      const align = typeof d.align === 'string' ? String(d.align) : 'center'
      const alignCss =
        align === 'left' ? 'margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : 'margin:0 auto;'
      const aspectRatioStyle = !height && autoSize && hasAspectRatio ? `aspect-ratio:${aspectRatio};` : ''
      const sizeStyle = ` style="${width ? `width:${esc(width)};` : ''}${height ? `height:${esc(height)};aspect-ratio:auto;` : aspectRatioStyle}${alignCss}"`
      const wrap = (content: string) => `<div class="artifact-wrapper"${sizeStyle}>${content}</div>`

      if (rawSource) {
        if (/^https?:\/\//i.test(rawSource)) {
          return wrap(
            `<iframe src="${esc(rawSource)}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`,
          )
        }
        const inlineSource =
          d.config && typeof d.config === 'object' && Object.keys(d.config).length > 0
            ? buildSourceWithConfig(
                rawSource,
                d.config as Record<string, unknown>,
                typeof (d.factory as { key?: unknown } | null | undefined)?.key === 'string'
                  ? String((d.factory as { key: string }).key)
                  : 'data-config',
              )
            : rawSource
        const moduleId = mod.id || `artifact-${mod.order}`
        const srcdoc = buildInlineArtifactSrcdoc(inlineSource, {
          apiUrl: API_URL,
          moduleId,
          slideId: slide.id,
          surface: 'preview',
        })
        return wrap(
          `<iframe srcdoc="${esc(srcdoc)}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`,
        )
      }

      if (rawSrc) {
        const src = rewriteAssetSrc(rawSrc)
        return wrap(
          `<iframe src="${esc(src)}" sandbox="allow-scripts" loading="lazy" title="${alt}" referrerpolicy="origin-when-cross-origin"></iframe>`,
        )
      }

      return `<div class="artifact-wrapper" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">${alt}</div>`
    }

    case 'code': {
      const code = String(d.code || d.content || '')
      const language = String(d.language || '')
      return `<div class="code-wrapper"><pre><code class="language-${esc(language)}">${esc(code)}</code></pre></div>`
    }

    case 'quote': {
      const text = String(d.quote || d.text || '')
      const cite = String(d.cite || d.author || '')
      let html = `<blockquote><p>${esc(text)}</p>`
      if (cite) html += `<cite>${esc(cite)}</cite>`
      html += '</blockquote>'
      return html
    }

    default:
      return `<div class="text-body">${esc(JSON.stringify(d))}</div>`
  }
}

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
  const isDarkPrimary = isDark(primary)
  const primaryText = isDarkPrimary ? '#ffffff' : '#1a1a2e'
  const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const splitBg = dark ? '#172a45' : '#e8eef6'
  const gridBg = dark ? '#0f3444' : '#e9f5f7'
  const accentLabel = dark ? accent : darkenHex(accent, 0.55)
  const secondaryLabel = dark ? secondary : darkenHex(secondary, 0.7)

  return `
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
      --layout-split-bg: ${splitBg};
      --layout-grid-bg: ${gridBg};
      --accent-cyan: ${accent};
      --accent-blue: ${secondary};
      --accent-navy: ${primary};
      --text-primary: ${text};
      --text-muted: ${textMuted};
      --border-subtle: ${border};
    }
    html, body { background: ${bg}; color: ${text}; font-family: '${bodyFont}', sans-serif; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    .title-slide, .layout-divider, .closing-slide { background: ${primary}; color: ${primaryText}; }
    .title-slide h1, .title-slide h2, .title-slide h3, .title-slide h4,
    .layout-divider h1, .layout-divider h2, .layout-divider h3,
    .closing-slide h1, .closing-slide h2, .closing-slide h3 { color: ${primaryText}; }
    .title-slide p, .title-slide .text-body, .layout-divider p, .closing-slide p, .closing-slide .text-body { color: ${isDarkPrimary ? 'rgba(255,255,255,0.85)' : 'rgba(26,26,46,0.7)'}; }
    .layout-full-dark { background: #0d1117; color: #f0f0f0; }
    .layout-full-dark h1, .layout-full-dark h2, .layout-full-dark h3, .layout-full-dark h4 { color: #f0f0f0; }
    .layout-full-dark p, .layout-full-dark .text-body { color: rgba(240,240,240,0.65); }
    .card { background: ${cardBg}; border-color: ${border}; }
    .card-cyan { border-left-color: ${accent}; }
    .card-navy { border-left-color: ${primary}; }
    .label-cyan { color: ${accentLabel}; }
    .label-blue { color: ${secondaryLabel}; }
    .tip-box { background: ${accent}0d; border-color: ${accent}1f; }
    .tip-box strong { color: ${accent}; }
    .stream-list li { border-left-color: ${accent}; background: ${cardBg}; color: ${textMuted}; }
    .text-body { color: ${textMuted}; }
    .comparison-panel { background: ${cardBg}; border-color: ${border}; }
    .comparison-panel p { color: ${textMuted}; }
    .card p { color: ${textMuted}; }
    .flow-node { background: ${cardBg}; border-color: ${border}; }
    .flow-arrow { color: ${textMuted}; }
    .prompt-block { color: ${text}; }
    blockquote { color: ${text}; }
    figcaption { color: ${textMuted}; }
  `
}

export function renderSlideHtml(slide: Slide, theme: Theme | null | undefined): string {
  const sections = getSlideSections(slide)

  let bodyHtml: string
  if (sections.layout === 'layout-split') {
    const contentHtml = sections.contentModules.map((mod) => renderModule(mod, slide)).join('\n      ')
    const stageHtml = sections.stageModules.map((mod) => renderModule(mod, slide)).join('\n      ')

    bodyHtml = `
    <div class="slide ${esc(sections.layout)}">
      <div class="content" style="flex: ${sections.splitRatio}">
        ${contentHtml}
      </div>
      <div class="stage" style="flex: ${1 - sections.splitRatio}">
        ${stageHtml}
      </div>
    </div>`
  } else {
    const innerHtml = sections.primaryModules.map((mod) => renderModule(mod, slide)).join('\n      ')
    bodyHtml = `
    <div class="slide ${esc(sections.layout)}">
      <div class="${sections.primaryWrapperClass}">
        ${innerHtml}
      </div>
    </div>`
  }

  const themeCss = buildThemeCss(theme)
  const headingFont = theme?.fonts?.heading
  const bodyFont = theme?.fonts?.body
  const extraFonts: string[] = []
  if (headingFont && !['Inter', 'Outfit', 'JetBrains Mono'].includes(headingFont)) {
    extraFonts.push(headingFont.replace(/ /g, '+'))
  }
  if (bodyFont && bodyFont !== headingFont && !['Inter', 'Outfit', 'JetBrains Mono'].includes(bodyFont)) {
    extraFonts.push(bodyFont.replace(/ /g, '+'))
  }
  const extraFontLink = extraFonts.length
    ? `\n  <link href="https://fonts.googleapis.com/css2?${extraFonts.map((font) => `family=${font}:wght@400;500;600;700`).join('&')}&display=swap" rel="stylesheet">`
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
