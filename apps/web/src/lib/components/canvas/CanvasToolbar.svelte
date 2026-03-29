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

  // Branding
  let showBranding = $state(false)
  let brandingLogo = $state('')
  let brandingPosition = $state('top-left')

  $effect(() => {
    const meta = $currentDeck?.metadata as Record<string, unknown> | undefined
    if (meta?.branding) {
      const b = meta.branding as { logo?: string; position?: string }
      brandingLogo = b.logo ?? ''
      brandingPosition = b.position ?? 'top-left'
    }
  })

  async function saveBranding() {
    if (!$currentDeck) return
    const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'
    const branding = brandingLogo ? { logo: brandingLogo, position: brandingPosition } : null
    const newMetadata = { ...($currentDeck.metadata as Record<string, unknown>), branding }

    currentDeck.update((d) => d ? { ...d, metadata: newMetadata } : d)

    await fetch(`${API_URL}/api/decks/${$currentDeck.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: newMetadata }),
    }).catch(console.error)

    showBranding = false
  }

  let exporting = $state(false)

  async function handleExport() {
    if (!$currentDeck || exporting) return
    exporting = true
    const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'
    try {
      const res = await fetch(`${API_URL}/api/decks/${$currentDeck.id}/export`, { method: 'POST', credentials: 'include' })
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
    <div class="branding-wrapper">
      <button class="branding-btn" onclick={() => { showBranding = !showBranding }} title="Branding / Logo">
        Logo
      </button>
      {#if showBranding}
        <div class="branding-panel">
          <label class="branding-field">
            <span>Logo URL</span>
            <input type="text" bind:value={brandingLogo} placeholder="https://..." />
          </label>
          <label class="branding-field">
            <span>Position</span>
            <select bind:value={brandingPosition}>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </label>
          <button class="branding-save" onclick={saveBranding}>Save</button>
        </div>
      {/if}
    </div>
    <button
      class="preview-btn"
      onclick={() => {
        if (!$currentDeck) return
        const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'
        window.open(`${API_URL}/api/decks/${$currentDeck.id}/preview`, '_blank')
      }}
      disabled={!$currentDeck}
    >
      Preview
    </button>
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
    gap: 0.5rem;
  }
  .branding-wrapper {
    position: relative;
  }
  .branding-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: background 0.15s, border-color 0.15s;
  }
  .branding-btn:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
  }
  .branding-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--color-bg, white);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 10px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 220px;
  }
  .branding-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .branding-field span {
    font-size: 10px;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .branding-field input,
  .branding-field select {
    font-size: 11px;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    outline: none;
  }
  .branding-field input:focus,
  .branding-field select:focus {
    border-color: #3b82f6;
  }
  .branding-save {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .branding-save:hover { opacity: 0.9; }
  .preview-btn {
    background: var(--color-primary, #3b82f6);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .preview-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .preview-btn:disabled {
    opacity: 0.5;
    cursor: default;
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
