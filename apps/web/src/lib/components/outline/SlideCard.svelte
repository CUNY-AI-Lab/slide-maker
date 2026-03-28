<script lang="ts">
  import { get } from 'svelte/store'
  import BlockItem from './BlockItem.svelte'
  import { activeSlideId } from '$lib/stores/ui'
  import { currentDeck, removeSlideFromDeck } from '$lib/stores/deck'

  let { slide, active, index }: {
    slide: {
      id: string
      deckId: string
      type: string
      order: number
      blocks: { id: string; type: string; data: Record<string, unknown> }[]
    }
    active: boolean
    index: number
  } = $props()

  let deleting = $state(false)

  function handleClick() {
    activeSlideId.set(slide.id)
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    deleting = true

    const deck = get(currentDeck)
    if (!deck) return

    const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

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

<div class="slide-card" class:active onclick={handleClick} onkeydown={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
  <div class="card-header">
    <span class="drag-handle" title="Drag to reorder">{'\u2807'}</span>
    <span class="arrow">{active ? '\u25BC' : '\u25B6'}</span>
    <span class="slide-label">{index + 1}. {slide.type}</span>
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

  {#if active && slide.blocks.length > 0}
    <div class="blocks-list">
      {#each slide.blocks as block (block.id)}
        <BlockItem {block} />
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
