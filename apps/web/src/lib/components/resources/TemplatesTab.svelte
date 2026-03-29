<script lang="ts">
  import { get } from 'svelte/store'
  import { currentDeck, addSlideToDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { API_URL } from '$lib/api'

  interface Template {
    id: string
    name: string
    layout: string
    modules: { type: string; zone: string; data: Record<string, unknown>; stepOrder?: number }[]
    thumbnail: string | null
    builtIn: boolean
  }

  let templates = $state<Template[]>([])
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
    const groups: Record<string, Template[]> = {}
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
    'title-slide':      { bg: '#1D3A83', fg: 'rgba(255,255,255,0.25)', accent: 'rgba(255,255,255,0.15)' },
    // Give split layouts a slightly different navy with cool complement accents
    'layout-split':     { bg: '#172a45', fg: 'rgba(255,255,255,0.22)',  accent: 'rgba(255,255,255,0.12)' },
    // Leave full-content neutral to imply text-first slides
    'layout-content':   { bg: '#f1f5f9', fg: 'rgba(59,115,230,0.12)',  accent: 'rgba(59,115,230,0.06)' },
    // Grid layouts get a teal-leaning complement to the title navy
    'layout-grid':      { bg: '#0f3444', fg: 'rgba(255,255,255,0.22)',  accent: 'rgba(255,255,255,0.12)' },
    'layout-full-dark': { bg: '#333333', fg: 'rgba(255,255,255,0.15)', accent: 'rgba(255,255,255,0.08)' },
    'layout-divider':   { bg: '#3B73E6', fg: 'rgba(255,255,255,0.25)', accent: 'rgba(255,255,255,0.12)' },
    'closing-slide':    { bg: '#1D3A83', fg: 'rgba(255,255,255,0.25)', accent: 'rgba(255,255,255,0.12)' },
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

  const splitVariantsLight = [
    { bg: '#e8eef6', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
    { bg: '#e9f0fb', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
    { bg: '#e7f0f8', fg: 'rgba(59,115,230,0.25)', accent: 'rgba(59,115,230,0.14)' },
  ]
  const gridVariantsLight = [
    { bg: '#e9f5f7', fg: 'rgba(47,184,214,0.28)', accent: 'rgba(47,184,214,0.16)' },
    { bg: '#e6f1f4', fg: 'rgba(47,184,214,0.28)', accent: 'rgba(47,184,214,0.16)' },
  ]

  // Preview mode (Dark/Light) for thumbnails only
  let previewMode = $state<'dark' | 'light'>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem('templatesPreviewMode') as 'dark' | 'light')) || 'dark'
  )
  $effect(() => {
    try { localStorage.setItem('templatesPreviewMode', previewMode) } catch {}
  })

  $effect(() => {
    fetch(`${API_URL}/api/templates`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        templates = data.templates ?? []
        loading = false
      })
      .catch((err) => {
        console.error('Failed to fetch templates:', err)
        error = 'Failed to load templates'
        loading = false
      })
  })

  async function applyTemplate(template: Template) {
    const deck = get(currentDeck)
    if (!deck) return

    try {
      const res = await fetch(`${API_URL}/api/decks/${deck.id}/slides`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: template.layout,
          modules: template.modules,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        const slide = { ...result, blocks: result.blocks || result.modules || [] }
        addSlideToDeck(slide)
        activeSlideId.set(slide.id)
      }
    } catch (err) {
      console.error('Failed to create slide from template:', err)
    }
  }
</script>

<div class="templates-tab">
  <div class="mode-toggle" role="group" aria-label="Preview mode">
    <button
      class:active={previewMode==='dark'}
      aria-pressed={previewMode==='dark'}
      title="Dark previews"
      aria-label="Dark previews"
      onclick={() => previewMode='dark'}>
      <span aria-hidden="true">☾</span>
      <span class="sr-only">Dark</span>
    </button>
    <button
      class:active={previewMode==='light'}
      aria-pressed={previewMode==='light'}
      title="Light previews"
      aria-label="Light previews"
      onclick={() => previewMode='light'}>
      <span aria-hidden="true">☀</span>
      <span class="sr-only">Light</span>
    </button>
  </div>
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
          {#each group.templates as tmpl, i (tmpl.id)}
            {@const base = layoutMeta[tmpl.layout] ?? { bg: '#e5e7eb', fg: 'rgba(0,0,0,0.1)', accent: 'rgba(0,0,0,0.05)' }}
            {@const dark = previewMode === 'dark'}
            {@const meta = tmpl.layout === 'layout-split' ? (dark ? splitVariants[i % splitVariants.length] : splitVariantsLight[i % splitVariantsLight.length])
                            : tmpl.layout === 'layout-grid' ? (dark ? gridVariants[i % gridVariants.length] : gridVariantsLight[i % gridVariantsLight.length])
                            : base}
            <button class="template-card" onclick={() => applyTemplate(tmpl)}>
              <div class="thumbnail" style:background={meta.bg}>
                {#if tmpl.layout === 'title-slide' || tmpl.layout === 'closing-slide'}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar z-narrow" style:background={meta.accent}></div>
                  </div>
                {:else if tmpl.layout === 'layout-split'}
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
                {:else if tmpl.layout === 'layout-content'}
                  <div class="thumb-zones thumb-full">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                  </div>
                {:else if tmpl.layout === 'layout-grid'}
                  <div class="thumb-zones thumb-grid">
                    <div class="z-card" style:background={meta.fg}></div>
                    <div class="z-card" style:background={meta.fg}></div>
                    <div class="z-card" style:background={meta.fg}></div>
                  </div>
                {:else if tmpl.layout === 'layout-full-dark'}
                  <div class="thumb-zones thumb-full">
                    <div class="z-bar z-wide" style:background={meta.fg}></div>
                    <div class="z-bar" style:background={meta.accent}></div>
                  </div>
                {:else if tmpl.layout === 'layout-divider'}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar z-narrow" style:background={meta.fg}></div>
                  </div>
                {:else}
                  <div class="thumb-zones thumb-center">
                    <div class="z-bar" style:background={meta.fg}></div>
                  </div>
                {/if}
              </div>
              <div class="template-info">
                <span class="template-name">{tmpl.name}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .templates-tab {
    padding: 8px;
  }

  .mode-toggle { display: inline-flex; gap: 2px; margin: 2px 4px 8px; border: 1px solid var(--color-border, #e5e7eb); border-radius: 999px; padding: 2px; }
  .mode-toggle button { width: 24px; height: 24px; display: grid; place-items: center; border: none; background: transparent; color: var(--color-text-muted, #6b7280); border-radius: 999px; cursor: pointer; font-size: 12px; }
  .mode-toggle button.active { background: var(--color-ghost-bg, rgba(59,115,230,0.12)); color: var(--color-primary, #3B73E6); }
  .mode-toggle button:focus-visible { outline: 2px solid var(--color-primary, #3B73E6); outline-offset: 1px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

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
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    border: none;
    border-radius: var(--radius-sm);
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    padding: 0;
    transition: box-shadow 0.15s;
  }

  .template-card:hover {
    box-shadow: 0 1px 6px rgba(59, 115, 230, 0.12);
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

  .template-info {
    padding: 6px 8px;
  }

  .template-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text, #1f2937);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group-header {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
