<script lang="ts">
  import SlideCard from './SlideCard.svelte'
  import AddSlideMenu from './AddSlideMenu.svelte'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { dndzone } from 'svelte-dnd-action'
  import { API_URL } from '$lib/api'

  let deck = $state<any>(null)
  let activeId = $state<string | null>(null)
  let dragItems = $state<any[]>([])

  $effect(() => {
    const unsub = currentDeck.subscribe((v) => { deck = v })
    return unsub
  })

  $effect(() => {
    const unsub = activeSlideId.subscribe((v) => { activeId = v })
    return unsub
  })

  // Sync dragItems from store when not actively dragging
  $effect(() => {
    dragItems = (deck?.slides ?? []).map((s: any) => ({ ...s }))
  })

  // Scroll to newly active slide
  $effect(() => {
    if (activeId) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-slide-id="${activeId}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  })

  function handleConsider(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items
  }

  async function handleFinalize(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items

    // Update the store with the new order
    currentDeck.update((d) => {
      if (!d) return d
      return { ...d, slides: dragItems.map((item, i) => ({ ...item, order: i })) }
    })

    // Persist to API
    if (deck) {
      try {
        await fetch(`${API_URL}/api/decks/${deck.id}/slides/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ order: dragItems.map((item) => item.id) }),
        })
      } catch (err) {
        console.error('Failed to persist slide reorder:', err)
      }
    }
  }
</script>

<div class="slide-outline">
  <div class="outline-header">
    <span class="outline-label">SLIDES</span>
    {#if deck}
      <AddSlideMenu deckId={deck.id} />
    {/if}
  </div>

  {#if dragItems.length === 0}
    <div class="slide-list">
      <div class="empty">No slides yet</div>
    </div>
  {:else}
    <div
      class="slide-list"
      use:dndzone={{ items: dragItems, flipDurationMs: 200 }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each dragItems as slide, i (slide.id)}
        <SlideCard {slide} active={slide.id === activeId} index={i} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .slide-outline {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .outline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    flex-shrink: 0;
  }

  .outline-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted, #6b7280);
  }

  .slide-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 12px;
    color: var(--color-text-muted, #9ca3af);
    padding: 20px;
  }
</style>
