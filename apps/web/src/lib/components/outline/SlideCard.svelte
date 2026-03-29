<script lang="ts">
  import { get } from 'svelte/store'
  import { dndzone } from 'svelte-dnd-action'
  import BlockItem from './BlockItem.svelte'
  import { activeSlideId } from '$lib/stores/ui'
  import { currentDeck, removeSlideFromDeck, updateSlideInDeck } from '$lib/stores/deck'
  import { API_URL } from '$lib/api'

  const layoutLabels: Record<string, string> = {
    'title-slide': 'Title Slide',
    'layout-split': 'Split (Text + Visual)',
    'layout-content': 'Full Content',
    'layout-grid': 'Card Grid',
    'layout-full-dark': 'Dark Section',
    'layout-divider': 'Section Break',
    'closing-slide': 'Closing',
  }

  let { slide, active, index }: {
    slide: {
      id: string
      deckId: string
      layout: string
      order: number
      blocks: { id: string; slideId: string; type: string; zone: string; data: Record<string, unknown>; order: number; stepOrder: number | null }[]
    }
    active: boolean
    index: number
  } = $props()

  let layoutLabel = $derived(layoutLabels[slide.layout] ?? slide.layout)

  let deleting = $state(false)
  let blockItems = $state(slide.blocks)

  $effect(() => {
    blockItems = slide.blocks
  })

  function handleDndConsider(e: CustomEvent<{ items: typeof blockItems }>) {
    blockItems = e.detail.items
  }

  function handleDndFinalize(e: CustomEvent<{ items: typeof blockItems }>) {
    blockItems = e.detail.items
    updateSlideInDeck(slide.id, (s) => ({ ...s, blocks: blockItems }))
  }

  function handleClick() {
    activeSlideId.set(slide.id)
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    deleting = true

    const deck = get(currentDeck)
    if (!deck) return

    try {
      const res = await fetch(`${API_URL}/api/decks/${deck.id}/slides/${slide.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (res.ok) {
        removeSlideFromDeck(slide.id)
        // If deleted slide was active, clear or pick another
        const updatedDeck = get(currentDeck)
        if (get(activeSlideId) === slide.id) {
          const remaining = updatedDeck?.slides ?? []
          activeSlideId.set(remaining.length > 0 ? remaining[0].id : null)
        }
      }
    } catch (err) {
      console.error('Failed to delete slide:', err)
    } finally {
      deleting = false
    }
  }
</script>

<div class="slide-card" class:active data-slide-id={slide.id} onclick={handleClick} onkeydown={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
  <div class="card-header">
    <span class="drag-handle" title="Drag to reorder">{'\u2807'}</span>
    <span class="arrow">{active ? '\u25BC' : '\u25B6'}</span>
    <span class="slide-label">{index + 1}. {layoutLabel}</span>
    {#if active}
      <span class="active-badge">ACTIVE</span>
    {/if}
    <button
      class="delete-btn"
      onclick={handleDelete}
      disabled={deleting}
      title="Delete slide"
    >
      {'\u2715'}
    </button>
  </div>

  {#if active && blockItems.length > 0}
    <div class="blocks-list" use:dndzone={{ items: blockItems, flipDurationMs: 200, dropTargetStyle: {} }} onconsider={handleDndConsider} onfinalize={handleDndFinalize}>
      {#each blockItems as block (block.id)}
        <div>
          <BlockItem {block} slideId={slide.id} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .slide-card {
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    margin: 0 6px 4px;
    background: white;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .slide-card.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 500;
    user-select: none;
  }

  .drag-handle {
    font-size: 14px;
    color: var(--color-text-muted, #9ca3af);
    flex-shrink: 0;
    cursor: grab;
    line-height: 1;
    margin-right: 2px;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .arrow {
    font-size: 9px;
    color: var(--color-text-muted, #6b7280);
    flex-shrink: 0;
    width: 12px;
  }

  .slide-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text, #1f2937);
  }

  .active-badge {
    font-size: 9px;
    font-weight: 700;
    color: #3b82f6;
    background: #dbeafe;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
    letter-spacing: 0.3px;
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted, #9ca3af);
    font-size: 11px;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
  }

  .slide-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
  }

  .delete-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .blocks-list {
    padding-bottom: 4px;
  }
</style>
