<script lang="ts">
  import { untrack } from 'svelte'
  import { get } from 'svelte/store'
  import { flip } from 'svelte/animate'
  import { dragHandleZone, dragHandle } from 'svelte-dnd-action'
  import BlockItem from './BlockItem.svelte'
  import { activeSlideId, setActiveSlide } from '$lib/stores/ui'
  import { currentDeck, removeSlideFromDeck, updateSlideInDeck } from '$lib/stores/deck'
  import { API_URL } from '$lib/api'
  import { applyMutation } from '$lib/utils/mutations'

  const layoutLabels: Record<string, string> = {
    'title-slide': 'Title Slide',
    'layout-split': 'Split (Text + Visual)',
    'layout-content': 'Full Content',
    'layout-grid': 'Card Grid',
    'layout-full-dark': 'Dark Section',
    'layout-divider': 'Section Break',
    'closing-slide': 'Closing',
  }

  const flipDurationMs = 200

  let { slide, active, index }: {
    slide: {
      id: string
      deckId: string
      layout: string
      order: number
      title?: string | null
      blocks: { id: string; slideId: string; type: string; zone: string; data: Record<string, unknown>; order: number; stepOrder: number | null }[]
    }
    active: boolean
    index: number
  } = $props()

  let layoutLabel = $derived(layoutLabels[slide.layout] ?? slide.layout)
  let displayLabel = $derived(slide.title?.trim() ? slide.title : layoutLabel)

  let editingTitle = $state(false)
  let titleDraft = $state('')
  let titleInput: HTMLInputElement | undefined = $state()

  function startRename(e?: MouseEvent) {
    e?.stopPropagation()
    titleDraft = slide.title ?? ''
    editingTitle = true
    queueMicrotask(() => { titleInput?.focus(); titleInput?.select() })
  }

  async function commitRename() {
    if (!editingTitle) return
    const next = titleDraft.trim().slice(0, 120)
    const prev = slide.title ?? ''
    if (next === prev) { editingTitle = false; return }
    try {
      await applyMutation({
        action: 'updateSlide',
        payload: { slideId: slide.id, title: next.length > 0 ? next : null },
      })
      editingTitle = false
    } catch (err) {
      console.error('Failed to rename slide:', err)
      // Keep the editor open with the user's draft so they can retry/copy it.
    }
  }

  function cancelRename() {
    editingTitle = false
    titleDraft = ''
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    // Stop propagation so the parent card-header's keydown (Enter toggles expand)
    // doesn't re-fire after we commit/cancel.
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitRename() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename() }
  }

  let deleting = $state(false)
  let expanded = $state(false)
  type Block = typeof slide.blocks[number]
  let blockItems = $state<Block[]>([])
  let draggingBlocks = false  // plain boolean — invisible to reactive system

  $effect(() => {
    const blocks = slide.blocks
    if (untrack(() => !draggingBlocks)) {
      blockItems = blocks.map((b) => ({ ...b }))
    }
  })

  function handleDndConsider(e: CustomEvent<{ items: typeof blockItems }>) {
    draggingBlocks = true
    blockItems = e.detail.items
  }

  async function handleDndFinalize(e: CustomEvent<{ items: typeof blockItems }>) {
    blockItems = e.detail.items.map((b, i) => ({ ...b, order: i }))
    draggingBlocks = false

    // Group by zone and dispatch through mutation layer for undo/redo support
    const byZone = new Map<string, string[]>()
    for (const item of blockItems) {
      const z = item.zone ?? 'content'
      if (!byZone.has(z)) byZone.set(z, [])
      byZone.get(z)!.push(item.id)
    }
    for (const [z, order] of byZone) {
      await applyMutation({ action: 'reorderBlocks', payload: { slideId: slide.id, zone: z, order } })
    }
  }

  // Auto-expand when this slide becomes active
  $effect(() => {
    if (active) expanded = true
  })

  function handleClick(e?: MouseEvent) {
    // Ignore clicks on the delete button (Svelte 5 event delegation)
    if (e && (e.target as HTMLElement).closest('.delete-btn')) return
    if (e && (e.target as HTMLElement).closest('.slide-title-input')) return
    if (editingTitle) return
    if (active) {
      expanded = !expanded
    } else {
      expanded = true
      setActiveSlide(slide.id, index + 1)
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    deleting = true

    const deck = get(currentDeck)
    if (!deck) { deleting = false; return }

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

<div class="slide-card" class:active data-slide-id={slide.id}>
  <div class="card-header" onclick={handleClick} onkeydown={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
    <span class="drag-handle" use:dragHandle title="Drag to reorder">{'\u2807'}</span>
    <span class="arrow">{expanded ? '\u25BC' : '\u25B6'}</span>
    {#if editingTitle}
      <span class="slide-label">{index + 1}.&nbsp;</span>
      <input
        class="slide-title-input"
        bind:this={titleInput}
        bind:value={titleDraft}
        onkeydown={handleTitleKeydown}
        onblur={commitRename}
        onclick={(e) => e.stopPropagation()}
        maxlength="120"
        placeholder={layoutLabel}
        aria-label="Slide {index + 1} title"
      />
    {:else}
      <span
        class="slide-label"
        ondblclick={startRename}
        title="Double-click to rename"
      >{index + 1}. {displayLabel}</span>
    {/if}
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

  {#if expanded && blockItems.length > 0}
    <div class="blocks-list" use:dragHandleZone={{ items: blockItems, flipDurationMs, dropTargetStyle: {}, dropFromOthersDisabled: true }} onconsider={handleDndConsider} onfinalize={handleDndFinalize}>
      {#each blockItems as block (block.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
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
    margin: 0 6px 2px;
    background: var(--color-bg);
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .slide-card.active {
    border-color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 13px;
    font-weight: 500;
    user-select: none;
  }

  .drag-handle {
    font-size: 16px;
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
    font-size: 10px;
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

  .slide-title-input {
    flex: 1;
    min-width: 0;
    font: inherit;
    color: var(--color-text, #1f2937);
    background: var(--color-bg, #fff);
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: 3px;
    padding: 1px 4px;
    outline: none;
    /* Parent card-header sets user-select: none, which cascades in Safari */
    user-select: text;
    -webkit-user-select: text;
  }

  .active-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-primary);
    background: none;
    padding: 1px 0;
    border-radius: 0;
    flex-shrink: 0;
    letter-spacing: 0.4px;
    border-bottom: 1.5px solid var(--color-primary);
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted, #9ca3af);
    font-size: 12px;
    padding: 2px 4px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0;
    border-radius: 4px;
    transition: opacity 0.15s, color 0.15s;
  }

  .slide-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .delete-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .blocks-list {
    padding-bottom: 4px;
  }
</style>
