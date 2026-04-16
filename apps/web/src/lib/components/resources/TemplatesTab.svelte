<script lang="ts">
  import { get } from 'svelte/store'
  import { currentDeck, addSlideToDeck } from '$lib/stores/deck'
  import { setActiveSlide } from '$lib/stores/ui'
  import { chatDraft } from '$lib/stores/chat'
  import { API_URL } from '$lib/api'
  import { templatesStore, ensureTemplatesLoaded, type TemplateData } from '$lib/stores/templates'

  let templates = $derived($templatesStore)
  let loading = $state(true)
  let error = $state<string | null>(null)

  const groupLabels: Record<string, string> = {
    'title-slide': 'Title Slides',
    'layout-split': 'Split Layouts',
    'layout-content': 'Full Content',
    'layout-grid': 'Grid Layouts',
    'layout-full-dark': 'Dark Sections',
    'layout-divider': 'Section Dividers',
    'closing-slide': 'Closing Slides',
  }

  const groupOrder = ['title-slide', 'layout-split', 'layout-content', 'layout-grid', 'layout-full-dark', 'layout-divider', 'closing-slide']

  let grouped = $derived.by(() => {
    const groups: Record<string, TemplateData[]> = {}
    for (const t of templates) {
      if (!groups[t.layout]) groups[t.layout] = []
      groups[t.layout].push(t)
    }
    return groupOrder
      .filter((key) => groups[key]?.length > 0)
      .map((key) => ({ key, label: groupLabels[key] ?? key, templates: groups[key] }))
  })

  const layoutMeta: Record<string, { bg: string; fg: string; accent: string }> = {
    // Keep title/closing close to the existing deep navy
    'title-slide':      { bg: '#0f2b5c', fg: 'rgba(100,181,246,0.3)', accent: 'rgba(59,130,246,0.2)' },
    // Give split layouts a slightly different navy with cool complement accents
    'layout-split':     { bg: '#172a45', fg: 'rgba(255,255,255,0.22)',  accent: 'rgba(255,255,255,0.12)' },
    // Leave full-content neutral to imply text-first slides
    'layout-content':   { bg: '#f1f5f9', fg: 'rgba(59,115,230,0.12)',  accent: 'rgba(59,115,230,0.06)' },
    // Grid layouts get a teal-leaning complement to the title navy
    'layout-grid':      { bg: '#0f3444', fg: 'rgba(255,255,255,0.22)',  accent: 'rgba(255,255,255,0.12)' },
    'layout-full-dark': { bg: '#333333', fg: 'rgba(255,255,255,0.15)', accent: 'rgba(255,255,255,0.08)' },
    'layout-divider':   { bg: '#3B73E6', fg: 'rgba(255,255,255,0.25)', accent: 'rgba(255,255,255,0.12)' },
    'closing-slide':    { bg: '#0f2b5c', fg: 'rgba(100,181,246,0.3)', accent: 'rgba(59,130,246,0.2)' },
  }

  const layoutMetaLight: Record<string, { bg: string; fg: string; accent: string }> = {
    'title-slide':      { bg: '#dce4f5', fg: 'rgba(15,43,92,0.3)', accent: 'rgba(59,130,246,0.18)' },
    'closing-slide':    { bg: '#dce4f5', fg: 'rgba(15,43,92,0.3)', accent: 'rgba(59,130,246,0.18)' },
    'layout-divider':   { bg: '#e6edfa', fg: 'rgba(59,115,230,0.28)', accent: 'rgba(59,115,230,0.16)' },
    'layout-full-dark': { bg: '#e2e4e8', fg: 'rgba(0,0,0,0.12)', accent: 'rgba(0,0,0,0.06)' },
  }

  // Variants to introduce subtle per-card variety within groups
  const splitVariants: { bg: string; fg: string; accent: string }[] = [
    { bg: '#172a45', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
    { bg: '#102338', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
    { bg: '#1b2f4b', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
    { bg: '#13283e', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
  ]
  const gridVariants: { bg: string; fg: string; accent: string }[] = [
    { bg: '#0f3444', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
    { bg: '#0b2e3a', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
    { bg: '#123a4e', fg: 'rgba(255,255,255,0.22)', accent: 'rgba(255,255,255,0.12)' },
  ]

  const contentVariants: { bg: string; fg: string; accent: string }[] = [
    { bg: '#1e2a3a', fg: 'rgba(100,181,246,0.22)', accent: 'rgba(100,181,246,0.12)' },
    { bg: '#1a2635', fg: 'rgba(100,181,246,0.22)', accent: 'rgba(100,181,246,0.12)' },
    { bg: '#212e3f', fg: 'rgba(100,181,246,0.22)', accent: 'rgba(100,181,246,0.12)' },
  ]
  const contentVariantsLight = [
    { bg: '#f0f4fa', fg: 'rgba(29,58,131,0.18)', accent: 'rgba(29,58,131,0.10)' },
    { bg: '#ecf0f7', fg: 'rgba(29,58,131,0.18)', accent: 'rgba(29,58,131,0.10)' },
    { bg: '#eef2f9', fg: 'rgba(29,58,131,0.18)', accent: 'rgba(29,58,131,0.10)' },
  ]
  const splitVariantsLight = [
    { bg: '#e8eef6', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
    { bg: '#e9f0fb', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
    { bg: '#e7f0f8', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
  ]
  const gridVariantsLight = [
    { bg: '#e9f5f7', fg: 'rgba(47,184,214,0.28)', accent: 'rgba(47,184,214,0.16)' },
    { bg: '#e6f1f4', fg: 'rgba(47,184,214,0.28)', accent: 'rgba(47,184,214,0.16)' },
  ]

  // Preview mode follows editor dark mode
  import { editorDarkMode } from '$lib/stores/editor-theme'
  let previewMode = $derived<'dark' | 'light'>($editorDarkMode ? 'dark' : 'light')

  $effect(() => {
    ensureTemplatesLoaded()
      .then(() => { loading = false })
      .catch(() => { error = 'Failed to load templates'; loading = false })
  })

  function injectTemplateRef(template: TemplateData) {
    chatDraft.set(`@template:${template.name}`)
  }

  async function applyTemplate(template: TemplateData) {
    const deck = get(currentDeck)
    if (!deck) return

    try {
      // Normalize modules for consistency (e.g., artifacts auto-size by ratio)
      const normalizedModules = template.modules.map((m) => {
        if (m.type === 'artifact') {
          const data = { ...(m.data || {}) }
          // Remove fixed height from older templates; prefer auto-size + aspect ratio
          if ('height' in data) delete (data as Record<string, unknown>).height
          if (data.autoSize === undefined) (data as Record<string, unknown>).autoSize = true
          if (data.aspectRatio === undefined) (data as Record<string, unknown>).aspectRatio = 16 / 9
          return { ...m, data }
        }
        return m
      })

      const res = await fetch(`${API_URL}/api/decks/${deck.id}/slides`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: template.layout,
          modules: normalizedModules,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        const slide = { ...result, blocks: result.blocks || result.modules || [] }
        addSlideToDeck(slide)
        setActiveSlide(slide.id, (slide.order ?? 0) + 1)
      }
    } catch (err) {
      console.error('Failed to create slide from template:', err)
    }
  }
</script>

<div class="templates-tab">
  {#if loading}
    <div class="center-msg">Loading templates...</div>
  {:else if error}
    <div class="center-msg error">{error}</div>
  {:else if templates.length === 0}
    <div class="center-msg">No templates available yet. Templates will appear here after seeding.</div>
  {:else}
    {#each grouped as group}
      <div class="group">
        <h3 class="group-header">{group.label}</h3>
        <div class="template-grid">
          {#each group.templates as template, i (template.id)}
            {@const base = layoutMeta[template.layout] ?? { bg: '#e5e7eb', fg: 'rgba(0,0,0,0.1)', accent: 'rgba(0,0,0,0.05)' }}
            {@const dark = previewMode === 'dark'}
            {@const meta = template.layout === 'layout-split' ? (dark ? splitVariants[i % splitVariants.length] : splitVariantsLight[i % splitVariantsLight.length])
                            : template.layout === 'layout-content' ? (dark ? contentVariants[i % contentVariants.length] : contentVariantsLight[i % contentVariantsLight.length])
                            : template.layout === 'layout-grid' ? (dark ? gridVariants[i % gridVariants.length] : gridVariantsLight[i % gridVariantsLight.length])
                            : dark ? base : (layoutMetaLight[template.layout] ?? base)}
            <div class="template-card-wrap">
              <div class="template-card">
                <div class="thumbnail" style:background={meta.bg} aria-hidden="true">
                {#if template.layout === 'title-slide' || template.layout === 'closing-slide'}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar z-narrow" style:background={meta.accent}></div>
                  </div>
                {:else if template.layout === 'layout-split'}
                  <div class="thumb-zones thumb-split">
                    <div class="z-col z-left">
                      <div class="z-bar" style:background={meta.fg}></div>
                      <div class="z-bar z-wide" style:background={meta.accent}></div>
                      <div class="z-bar z-wide" style:background={meta.accent}></div>
                    </div>
                    <div class="z-col z-right">
                      <div class="z-block" style:background={meta.fg}></div>
                    </div>
                  </div>
                {:else if template.layout === 'layout-content' && template.modules.some(m => m.type === 'comparison')}
                  <div class="thumb-zones thumb-comparison">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-panels">
                      <div class="z-panel" style:background={meta.fg}></div>
                      <div class="z-panel" style:background={meta.fg}></div>
                    </div>
                  </div>
                {:else if template.layout === 'layout-content' && template.modules.some(m => m.type === 'flow')}
                  <div class="thumb-zones thumb-flow">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-flow-row">
                      <div class="z-flow-node" style:background={meta.fg}></div>
                      <div class="z-flow-arrow" style:background={meta.fg}></div>
                      <div class="z-flow-node" style:background={meta.fg}></div>
                      <div class="z-flow-arrow" style:background={meta.fg}></div>
                      <div class="z-flow-node" style:background={meta.fg}></div>
                    </div>
                  </div>
                {:else if template.layout === 'layout-content'}
                  <div class="thumb-zones thumb-full">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                    <div class="z-bar z-narrow" style:background={meta.accent}></div>
                  </div>
                {:else if template.layout === 'layout-grid'}
                  <div class="thumb-zones thumb-grid">
                    <div class="z-card" style:background={meta.fg}></div>
                    <div class="z-card" style:background={meta.fg}></div>
                    <div class="z-card" style:background={meta.fg}></div>
                  </div>
                {:else if template.layout === 'layout-full-dark'}
                  <div class="thumb-zones thumb-full">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                  </div>
                {:else if template.layout === 'layout-divider'}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar z-narrow" style:background={meta.fg}></div>
                  </div>
                {:else}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar" style:background={meta.fg}></div>
                  </div>
                {/if}
              </div>
              </div>
              <div class="template-info">
                <span class="template-name">{template.name}</span>
                <button class="act-btn act-add" onclick={() => applyTemplate(template)} title="Add this slide to the deck" aria-label="Add {template.name} slide">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 2v8M2 6h8"/></svg>
                </button>
                <button class="act-btn act-at" onclick={() => injectTemplateRef(template)} title="Mention in chat (@template)" aria-label="Mention in chat">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="6" cy="6" r="2"/><path d="M8 4.5v2.3a1.2 1.2 0 002.4 0V6a4.4 4.4 0 10-2.2 3.8"/></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .templates-tab {
    padding: 8px;
    overflow-x: hidden;
  }

  /* removed unused .mode-toggle styles */
  /* sr-only is now a global utility in app.css */

  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 16px;
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
    line-height: 1.5;
  }

  .center-msg.error {
    color: #ef4444;
  }

  .group {
    margin-bottom: 12px;
  }

  .group-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--color-text-muted, #6b7280);
    padding: 4px 4px 6px;
    margin: 0;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .template-card-wrap {
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    overflow: hidden;
    min-width: 0;
    transition: box-shadow 0.15s;
  }

  .template-card-wrap:hover {
    box-shadow: 0 1px 6px rgba(59, 115, 230, 0.12);
  }

  .template-card {
    display: block;
    width: 100%;
    border: none;
    padding: 0;
    background: transparent;
  }

  .thumbnail {
    height: 56px;
    width: 100%;
    position: relative;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  /* Structural miniature zones */
  .thumb-zones {
    position: absolute;
    inset: 0;
    display: flex;
    padding: 8px 10px;
    gap: 4px;
  }

  .thumb-center {
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .thumb-split {
    flex-direction: row;
    align-items: stretch;
  }

  .thumb-full {
    flex-direction: column;
    justify-content: center;
    padding: 8px 12px;
  }

  .thumb-grid {
    flex-direction: row;
    align-items: stretch;
    justify-content: center;
    padding: 10px;
    gap: 3px;
  }

  .z-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    justify-content: center;
  }

  .z-left {
    flex: 3;
    padding-right: 4px;
  }

  .z-right {
    flex: 2;
    display: flex;
    align-items: stretch;
  }

  .z-bar {
    height: 4px;
    border-radius: 2px;
    width: 60%;
  }

  .z-bar.z-wide {
    width: 80%;
  }

  .z-bar.z-narrow {
    width: 40%;
  }

  .z-block {
    flex: 1;
    border-radius: 3px;
  }

  .z-card {
    flex: 1;
    border-radius: 3px;
    min-height: 100%;
  }

  .thumb-comparison {
    flex-direction: column;
    justify-content: center;
    padding: 8px 12px;
  }

  .z-panels {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex: 1;
  }

  .z-panel {
    flex: 1;
    border-radius: 3px;
  }

  .thumb-flow {
    flex-direction: column;
    justify-content: center;
    padding: 8px 12px;
  }

  .z-flow-row {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 4px;
  }

  .z-flow-node {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .z-flow-arrow {
    width: 8px;
    height: 2px;
    border-radius: 1px;
    flex-shrink: 0;
  }

  .template-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px 4px 8px;
    gap: 4px;
  }

  .template-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text, #1f2937);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .act-btn {
    position: relative;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary, #6b7280);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  /* Enlarge tap target vertically. Horizontal extension is half the gap (2px)
     so adjacent act-btns in .template-info don't steal each other's clicks. */
  .act-btn::after {
    content: '';
    position: absolute;
    inset: -12px -2px;
  }

  .act-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
    border-color: var(--color-primary, #3B73E6);
  }

  .group-header {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
