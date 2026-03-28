<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'

  let slides = $derived($currentDeck?.slides ?? [])
  let sortedSlides = $derived([...slides].sort((a, b) => a.order - b.order))
  let currentIndex = $derived(
    $activeSlideId ? sortedSlides.findIndex((s) => s.id === $activeSlideId) : -1
  )
  let total = $derived(sortedSlides.length)

  function goToPrev() {
    if (currentIndex > 0) {
      $activeSlideId = sortedSlides[currentIndex - 1].id
    }
  }

  function goToNext() {
    if (currentIndex < total - 1) {
      $activeSlideId = sortedSlides[currentIndex + 1].id
    }
  }

  let exporting = $state(false)

  async function handleExport() {
    if (!$currentDeck || exporting) return
    exporting = true
    try {
      const res = await fetch(`/api/decks/${$currentDeck.id}/export`, { method: 'POST' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${$currentDeck.slug ?? 'deck'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      exporting = false
    }
  }
</script>

<div class="canvas-toolbar">
  <div class="toolbar-left">
    <button class="nav-btn" onclick={goToPrev} disabled={currentIndex <= 0} aria-label="Previous slide">
      &#8592;
    </button>
    <span class="slide-counter">
      {total > 0 ? `${currentIndex + 1} / ${total}` : 'No slides'}
    </span>
    <button class="nav-btn" onclick={goToNext} disabled={currentIndex >= total - 1} aria-label="Next slide">
      &#8594;
    </button>
  </div>
  <div class="toolbar-right">
    <button class="export-btn" onclick={handleExport} disabled={exporting || !$currentDeck}>
      {exporting ? 'Exporting...' : 'Export ZIP'}
    </button>
  </div>
</div>

<style>
  .canvas-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-shrink: 0;
  }
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .nav-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--color-text);
    transition: background 0.15s, border-color 0.15s;
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
  }
  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .slide-counter {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 4em;
    text-align: center;
  }
  .toolbar-right {
    display: flex;
    align-items: center;
  }
  .export-btn {
    background: var(--color-success);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .export-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .export-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
