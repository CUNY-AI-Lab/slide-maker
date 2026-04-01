<script lang="ts">
  import { addSlideToDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { API_URL } from '$lib/api'

  let { deckId, onAdd }: { deckId: string; onAdd?: () => void } = $props()

  let open = $state(false)
  let adding = $state(false)
  let triggerEl: HTMLButtonElement | undefined = $state()
  let dropdownStyle = $state('')

  function positionDropdown() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    dropdownStyle = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;`
  }

  const layouts = [
    { layout: 'title-slide', label: 'Title Slide', icon: '🎯', desc: 'Cover with title + subtitle' },
    { layout: 'layout-split', label: 'Split (Text + Visual)', icon: '◧', desc: 'Left text, right image/carousel' },
    { layout: 'layout-content', label: 'Full Content', icon: '▣', desc: 'Single column, full width' },
    { layout: 'layout-grid', label: 'Card Grid', icon: '▦', desc: 'Multi-column card layout' },
    { layout: 'layout-full-dark', label: 'Dark Section', icon: '◼', desc: 'Dark background overview' },
    { layout: 'layout-divider', label: 'Section Break', icon: '─', desc: 'Part label divider' },
    { layout: 'closing-slide', label: 'Closing', icon: '🏁', desc: 'Final slide, recap' },
  ]

  function toggle() {
    open = !open
    if (open) positionDropdown()
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.add-slide-menu')) {
      open = false
    }
  }

  async function addSlide(layout: string) {
    if (adding) return
    adding = true

    try {
      const res = await fetch(`${API_URL}/api/decks/${deckId}/slides`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout, type: layout }),
      })

      if (res.ok) {
        const result = await res.json()
        const slide = { ...result, blocks: result.blocks || result.modules || [] }
        addSlideToDeck(slide)
        activeSlideId.set(slide.id)
        onAdd?.()
      }
    } catch (err) {
      console.error('Failed to add slide:', err)
    } finally {
      adding = false
      open = false
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside, true)
      return () => document.removeEventListener('click', handleClickOutside, true)
    }
  })
</script>

<div class="add-slide-menu">
  <button class="add-btn" bind:this={triggerEl} onclick={toggle}>+</button>
  {#if open}
    <div class="dropdown" style={dropdownStyle}>
      {#each layouts as l}
        <button class="dropdown-item" onclick={() => addSlide(l.layout)} disabled={adding}>
          <span class="item-icon">{l.icon}</span>
          <span class="item-text">
            <span class="item-label">{l.label}</span>
            <span class="item-desc">{l.desc}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .add-slide-menu {
    position: relative;
  }

  .add-btn {
    font-size: 13px;
    padding: 2px 8px;
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s;
  }

  .add-btn:hover {
    background: var(--color-ghost-bg);
  }

  .dropdown {
    background: white;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 50;
    min-width: 240px;
    overflow: hidden;
  }

  .dropdown-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    font-size: 13px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text, #1f2937);
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background: #f3f4f6;
  }

  .dropdown-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .item-icon {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    font-size: 16px;
    line-height: 1.4;
  }

  .item-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .item-label {
    font-weight: 500;
    line-height: 1.4;
  }

  .item-desc {
    font-size: 11px;
    color: var(--color-text-muted, #9ca3af);
    line-height: 1.3;
  }
</style>
