<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId, setActiveSlide } from '$lib/stores/ui'
  import { editorDarkMode } from '$lib/stores/editor-theme'
  import { API_URL } from '$lib/api'
  import ShareDeckDialog from '$lib/components/gallery/ShareDeckDialog.svelte'

  type CanvasMode = 'edit' | 'view'
  let {
    canvasMode = 'view' as CanvasMode,
    onSetMode,
    onPreview,
  }: {
    canvasMode?: CanvasMode
    onSetMode?: (mode: CanvasMode) => void
    onPreview?: () => void
  } = $props()

  let slides = $derived($currentDeck?.slides ?? [])
  let sortedSlides = $derived([...slides].sort((a, b) => a.order - b.order))
  let currentIndex = $derived(
    $activeSlideId ? sortedSlides.findIndex((s) => s.id === $activeSlideId) : -1
  )
  let total = $derived(sortedSlides.length)

  function goToPrev() {
    if (currentIndex > 0) {
      setActiveSlide(sortedSlides[currentIndex - 1].id, currentIndex)
    }
  }

  function goToNext() {
    if (currentIndex < total - 1) {
      setActiveSlide(sortedSlides[currentIndex + 1].id, currentIndex + 2)
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

  let showShare = $state(false)

  let exporting = $state(false)

  async function handleExport() {
    if (!$currentDeck || exporting) return
    exporting = true
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
  <button class="back-btn" onclick={() => goto(`${base}/`)} title="Back to decks">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>
  <div class="sep"></div>
  <button class="nav-btn" onclick={goToPrev} disabled={currentIndex <= 0} aria-label="Previous slide">&#8592;</button>
  <span class="slide-counter">{total > 0 ? `${currentIndex + 1}/${total}` : '—'}</span>
  <button class="nav-btn" onclick={goToNext} disabled={currentIndex >= total - 1} aria-label="Next slide">&#8594;</button>
  <div class="sep"></div>
  <div class="mode-switcher">
    <button class="mode-btn" class:active={canvasMode === 'edit'} onclick={() => onSetMode?.('edit')} title="Edit slide content">Edit</button>
    <button class="mode-btn" class:active={canvasMode === 'view'} onclick={() => onSetMode?.('view')} title="View slide">View</button>
    <button class="mode-btn" onclick={() => onPreview?.()} title="Preview full deck in new tab">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </button>
  </div>
  <div class="toolbar-spacer"></div>
  <div class="branding-wrapper">
    <button class="icon-btn" onclick={() => { showBranding = !showBranding }} title="Branding / Logo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
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
  <button class="icon-btn" onclick={() => editorDarkMode.toggle()} title={$editorDarkMode ? 'Light mode' : 'Dark mode'} aria-label={$editorDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
    {#if $editorDarkMode}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {/if}
  </button>
  <button class="icon-btn" onclick={() => { showShare = true }} disabled={!$currentDeck} title="Share deck">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </button>
  <button class="icon-btn" onclick={handleExport} disabled={exporting || !$currentDeck} title="Export deck">
    {#if exporting}
      ...
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    {/if}
  </button>
</div>

{#if showShare && $currentDeck}
  <ShareDeckDialog deckId={$currentDeck.id} onclose={() => { showShare = false }} />
{/if}

<style>
  .canvas-toolbar {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-shrink: 0;
    gap: 2px;
    min-width: 0;
  }
  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .back-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }
  .sep {
    width: 1px;
    height: 16px;
    background: var(--color-border);
    margin: 0 3px;
    flex-shrink: 0;
  }
  .nav-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    cursor: pointer;
    color: var(--color-text);
    transition: background 0.12s, border-color 0.12s;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
  }
  .nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .slide-counter {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    min-width: 2.5em;
    text-align: center;
    flex-shrink: 0;
  }
  .toolbar-spacer {
    flex: 1;
    min-width: 4px;
  }
  .mode-switcher {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }
  .mode-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mode-btn:hover:not(.active) {
    background: var(--color-ghost-bg);
    color: var(--color-text-secondary);
  }
  .mode-btn.active {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .branding-wrapper {
    position: relative;
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
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .branding-field input,
  .branding-field select {
    font-size: 13px;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    outline: none;
  }
  .branding-field input:focus,
  .branding-field select:focus {
    border-color: var(--color-primary);
  }
  .branding-save {
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
  }
  .branding-save:hover {
    background: var(--color-ghost-bg);
  }
</style>
