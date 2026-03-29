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

  const thumbnailColors: Record<string, string> = {
    'title-slide': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'layout-split': '#f3f4f6',
    'layout-content': '#f3f4f6',
    'layout-grid': 'linear-gradient(135deg, #10b981, #3b82f6)',
    'layout-full-dark': 'linear-gradient(135deg, #1e293b, #334155)',
    'layout-divider': 'linear-gradient(135deg, #f59e0b, #ef4444)',
    'closing-slide': 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
  }

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
          {#each group.templates as tmpl (tmpl.id)}
            <button class="template-card" onclick={() => applyTemplate(tmpl)}>
              <div
                class="thumbnail"
                style:background={thumbnailColors[tmpl.layout] ?? '#e5e7eb'}
              ></div>
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
    background: white;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    padding: 0;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .template-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .thumbnail {
    height: 48px;
    width: 100%;
  }

  .template-info {
    padding: 6px 8px;
  }

  .template-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text, #1f2937);
  }
</style>
