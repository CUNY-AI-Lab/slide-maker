<script lang="ts">
  import { untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import SlideCard from './SlideCard.svelte'
  import AddSlideMenu from './AddSlideMenu.svelte'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { dndzone } from 'svelte-dnd-action'
  import { API_URL } from '$lib/api'
  import { history } from '$lib/stores/history'
  import { undo, redo } from '$lib/utils/mutations'

  let { onCollapse }: { onCollapse?: () => void } = $props()

  const canUndo = history.canUndo
  const canRedo = history.canRedo
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
      <button class="history-btn" title="Undo (Cmd+Z)" onclick={undo} disabled={!$canUndo} aria-label="Undo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><polyline points="7 6 3 10 7 14"/></svg>
      </button>
      <button class="history-btn" title="Redo (Cmd+Shift+Z)" onclick={redo} disabled={!$canRedo} aria-label="Redo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H8a4 4 0 0 0 0 8h10"/><polyline points="17 6 21 10 17 14"/></svg>
      </button>
      {#if $currentDeck}
        <AddSlideMenu deckId={$currentDeck.id} />
      {/if}
      {#if onCollapse}
        <button class="collapse-toggle" onclick={onCollapse} title="Collapse slides" aria-label="Collapse slides">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
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
      use:dndzone={{ items: dragItems, flipDurationMs, dropFromOthersDisabled: true, dragHandleSelector: '.drag-handle' }}
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
    padding: 6px 8px;
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

  .header-actions { display: flex; align-items: center; gap: 4px; }
  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    transition: color 0.12s, background 0.12s;
  }
  .collapse-toggle:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }
  .history-btn {
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid var(--color-border);
    border-radius: 6px; color: var(--color-text-muted);
    cursor: pointer; padding: 0;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }
  .history-btn:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-ghost-bg); }
  .history-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  .history-btn:disabled { opacity: 0.35; cursor: default; }

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
