<script lang="ts">
  import { untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import SlideCard from './SlideCard.svelte'
  import AddSlideMenu from './AddSlideMenu.svelte'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { dndzone } from 'svelte-dnd-action'
  import { API_URL } from '$lib/api'
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'

  const flipDurationMs = 200

  let dragItems = $state<any[]>([])
  let dragging = false  // plain boolean — NOT $state, so it's invisible to the reactive system

  // Sync dragItems from store — skips during drag so svelte-dnd-action owns the array
  $effect(() => {
    const slides = $currentDeck?.slides ?? []
    // untrack: reading `dragging` must not create a dependency
    if (untrack(() => !dragging)) {
      dragItems = slides.map((s: any) => ({ ...s }))
    }
  })

  // Scroll to newly active slide
  $effect(() => {
    if ($activeSlideId) {
      const id = $activeSlideId
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-slide-id="${id}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  })

  function handleConsider(e: CustomEvent<{ items: any[] }>) {
    dragging = true
    dragItems = e.detail.items
  }

  async function handleFinalize(e: CustomEvent<{ items: any[] }>) {
    dragItems = e.detail.items

    // Update store FIRST while dragging is still true (blocks the sync effect)
    const reordered = dragItems.map((item, i) => ({ ...item, order: i }))
    currentDeck.update((d) => {
      if (!d) return d
      return { ...d, slides: reordered }
    })

    // NOW allow syncing again — store already has new order, so next sync is safe
    dragging = false

    // Persist to API
    const deck = $currentDeck
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
    <div class="header-actions">
      <button class="back-btn" title="Back to decks" onclick={() => goto(`${base}/`)} aria-label="Back to decks">⟵</button>
      {#if $currentDeck}
        <AddSlideMenu deckId={$currentDeck.id} />
      {/if}
    </div>
  </div>

  {#if dragItems.length === 0}
    <div class="slide-list">
      <div class="empty">No slides yet</div>
    </div>
  {:else}
    <div
      class="slide-list"
      use:dndzone={{ items: dragItems, flipDurationMs }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each dragItems as slide, i (slide.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
          <SlideCard {slide} active={slide.id === $activeSlideId} index={i} />
        </div>
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
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted, #6b7280);
  }

  .header-actions { display: flex; align-items: center; gap: 6px; }
  .back-btn {
    width: 24px; height: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid var(--color-border);
    border-radius: 6px; color: var(--color-text-muted);
    cursor: pointer; font-size: 13px; line-height: 1;
  }
  .back-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-ghost-bg); }

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
    font-size: 13px;
    color: var(--color-text-muted, #9ca3af);
    padding: 20px;
  }
</style>
