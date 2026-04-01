<script lang="ts">
  import { untrack } from 'svelte'
  import '$lib/framework-preview.css'
  import { API_URL } from '$lib/api'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { activeTheme, ensureThemesLoaded, isDark } from '$lib/stores/themes'
  import CanvasToolbar from './CanvasToolbar.svelte'
  import FormatToolbar from './FormatToolbar.svelte'
  import SlideRenderer from './SlideRenderer.svelte'
  import type { Editor } from '@tiptap/core'

  type CanvasMode = 'edit' | 'view'

  let { editable = true, canvasMode = $bindable<CanvasMode>('view') }: { editable?: boolean; canvasMode?: CanvasMode } = $props()

  let activeSlide = $derived(
    $currentDeck?.slides.find((s) => s.id === $activeSlideId) ?? null
  )

  // Track the active TipTap editor for the format toolbar
  let activeEditor: Editor | null = $state(null)

  function handleEditorReady(editor: unknown) {
    activeEditor = editor as Editor
  }

  function handleEditorBlur() {
    // Small delay so toolbar clicks still work
    setTimeout(() => { activeEditor = null }, 300)
  }

  // Load themes on mount so activeTheme can resolve
  $effect(() => {
    ensureThemesLoaded()
  })

  // Derive theme
  let theme = $derived($activeTheme)

  function openPreview() {
    if (!$currentDeck) return
    window.open(`${API_URL}/api/decks/${$currentDeck.id}/preview`, '_blank')
  }

  // Clear stale editor ref when switching slides (keep the current mode)
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    $activeSlideId
    untrack(() => {
      activeEditor = null
    })
  })

  function setMode(mode: CanvasMode) {
    if (mode === 'edit' && !editable) return
    canvasMode = mode
    if (mode !== 'edit') activeEditor = null
  }

  function handleCanvasKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && canvasMode === 'edit') {
      setMode('view')
    }
  }

  // Derive theme-driven CSS variables for the SlideRenderer (edit mode)
  let themeStyle = $derived.by(() => {
    const bg = theme?.colors?.bg ?? '#111827'
    const dark = isDark(bg)
    const text = dark ? '#f0f0f0' : '#1a1a2e'
    const textMuted = dark ? 'rgba(240,240,240,0.65)' : 'rgba(26,26,46,0.65)'
    const primary = theme?.colors?.primary ?? '#1e3a5f'
    const primaryDark = isDark(primary)
    const primaryText = primaryDark ? '#ffffff' : '#1a1a2e'
    const primaryTextMuted = primaryDark ? 'rgba(255,255,255,0.7)' : 'rgba(26,26,46,0.7)'
    const secondary = theme?.colors?.secondary ?? '#3b82f6'
    const accent = theme?.colors?.accent ?? '#64b5f6'
    const headingFont = theme?.fonts?.heading ?? 'Outfit'
    const bodyFont = theme?.fonts?.body ?? 'Inter'
    const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
    const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'

    const splitBg = dark ? '#172a45' : '#e8eef6'
    const gridBg = dark ? '#0f3444' : '#e9f5f7'

    return [
      `--theme-bg: ${bg}`,
      `--theme-text: ${text}`,
      `--theme-text-muted: ${textMuted}`,
      `--theme-primary: ${primary}`,
      `--theme-primary-text: ${primaryText}`,
      `--theme-primary-text-muted: ${primaryTextMuted}`,
      `--theme-secondary: ${secondary}`,
      `--theme-accent: ${accent}`,
      `--theme-heading-font: ${headingFont}`,
      `--theme-body-font: ${bodyFont}`,
      `--theme-card-bg: ${cardBg}`,
      `--theme-border: ${border}`,
      `--layout-split-bg: ${splitBg}`,
      `--layout-grid-bg: ${gridBg}`,
    ].join('; ')
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="slide-canvas" onkeydown={handleCanvasKeydown}>
  <CanvasToolbar {canvasMode} onSetMode={setMode} onPreview={openPreview} />
  {#if editable && canvasMode === 'edit'}
    <FormatToolbar editor={activeEditor} />
  {/if}
  <div class="canvas-area">
    {#if activeSlide}
      {#if canvasMode === 'edit'}
        <div class="slide-frame" style={themeStyle}>
          <SlideRenderer slide={activeSlide} {editable} onEditorReady={handleEditorReady} />
        </div>
      {:else}
        <div class="slide-frame view-mode" style={themeStyle}>
          <SlideRenderer slide={activeSlide} editable={false} />
          {#if editable}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="click-overlay" onclick={() => setMode('edit')}></div>
            <div class="edit-hint">Click to edit</div>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="no-slide">No slide selected</div>
    {/if}
  </div>
</div>

<style>
  .slide-canvas {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }
  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    overflow: auto;
    /* Keep a sensible edit viewport: never too small, never exceed 100vh minus header/toolbars */
    min-height: clamp(420px, calc(100vh - 220px), 800px);
  }
  .slide-frame.view-mode {
    cursor: pointer;
    position: relative;
  }
  .click-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: pointer;
  }
  .edit-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.7rem;
    padding: 4px 12px;
    border-radius: 999px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .slide-frame.view-mode:hover .edit-hint {
    opacity: 1;
  }
  .slide-frame {
    width: 100%;
    height: auto;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    background: white;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .no-slide {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }
</style>
