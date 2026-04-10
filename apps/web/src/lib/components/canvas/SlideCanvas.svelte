<script lang="ts">
  import { onMount } from 'svelte'
  import { untrack } from 'svelte'
  import '$lib/framework-preview.css'
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { API_URL } from '$lib/api'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId, activeModuleControls, setActiveSlide } from '$lib/stores/ui'
  import { activeTheme, ensureThemesLoaded, isDark, darkenHex } from '$lib/stores/themes'
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
  let editorToken = 0

  // Overflow detection — compare inner content height against frame's CSS height
  let slideFrameEl: HTMLDivElement | undefined = $state()
  let slideInnerEl: HTMLDivElement | undefined = $state()
  let overflowing = $state(false)

  function checkOverflow() {
    const frame = slideFrameEl
    const inner = slideInnerEl
    if (!frame || !inner) { overflowing = false; return }
    // Frame height is set by CSS aspect-ratio: 16/9
    const frameH = frame.clientHeight
    const contentH = inner.scrollHeight
    overflowing = contentH > frameH + 4
  }

  $effect(() => {
    const inner = slideInnerEl
    if (!inner) { overflowing = false; return }
    const ro = new ResizeObserver(() => checkOverflow())
    ro.observe(inner)
    const mo = new MutationObserver(() => requestAnimationFrame(checkOverflow))
    mo.observe(inner, { childList: true, subtree: true })
    requestAnimationFrame(checkOverflow)
    return () => { ro.disconnect(); mo.disconnect() }
  })

  function handleEditorReady(editor: unknown) {
    editorToken++
    activeEditor = editor as Editor
  }

  function handleEditorBlur() {
    // Delay so toolbar interactions (dropdowns, buttons) don't kill the editor
    const token = editorToken
    setTimeout(() => {
      if (editorToken !== token) return
      // Don't clear if focus moved to the format toolbar (e.g., Size dropdown)
      const focused = document.activeElement
      if (focused?.closest('.format-toolbar')) return
      activeEditor = null
    }, 300)
  }

  // Load themes on mount so activeTheme can resolve
  $effect(() => {
    ensureThemesLoaded()
  })

  // Derive theme
  let theme = $derived($activeTheme)
  let themeMode = $derived(isDark(theme?.colors?.bg ?? '#111827') ? 'dark' : 'light')

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
      activeModuleControls.set(null)
    })
  })

  function setMode(mode: CanvasMode) {
    if (mode === 'edit' && !editable) return
    canvasMode = mode
    if (mode !== 'edit') activeEditor = null
  }

  function handleCanvasKeydown(e: KeyboardEvent) {
    // no-op — global handler below handles everything
  }

  // Global keyboard handler for slide navigation
  onMount(() => {
    function handleGlobalKeydown(e: KeyboardEvent) {
      // Skip if user is typing in an editable element
      const active = document.activeElement
      if (active?.closest('[contenteditable]') || active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return

      // Escape → back to gallery (skip if a dialog/overlay is open)
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"]')) return
        e.preventDefault()
        goto(`${base}/`)
        return
      }

      // Arrow keys → prev/next slide
      const allSlides = [...($currentDeck?.slides ?? [])].sort((a, b) => a.order - b.order)
      const idx = $activeSlideId ? allSlides.findIndex((s) => s.id === $activeSlideId) : -1

      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault()
        setActiveSlide(allSlides[idx - 1].id, idx)
      } else if (e.key === 'ArrowRight' && idx < allSlides.length - 1) {
        e.preventDefault()
        setActiveSlide(allSlides[idx + 1].id, idx + 2)
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  })

  // Derive theme-driven CSS variables for the SlideRenderer (edit mode)
  let themeStyle = $derived.by(() => {
    const bg = theme?.colors?.bg ?? '#111827'
    const dark = isDark(bg)
    const text = dark ? '#f0f0f0' : '#1a1a2e'
    const textMuted = dark ? 'rgba(240,240,240,0.65)' : 'rgba(26,26,46,0.65)'
    const primary = theme?.colors?.primary ?? '#1e3a5f'
    const primaryDark = isDark(primary)
    const primaryText = primaryDark ? '#ffffff' : '#1a1a2e'
    const primaryTextMuted = primaryDark ? 'rgba(255,255,255,0.85)' : 'rgba(26,26,46,0.7)'
    const secondary = theme?.colors?.secondary ?? '#3b82f6'
    const accent = theme?.colors?.accent ?? '#64b5f6'
    const headingFont = theme?.fonts?.heading ?? 'Outfit'
    const bodyFont = theme?.fonts?.body ?? 'Inter'
    const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
    const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'

    const splitBg = dark ? '#172a45' : '#e8eef6'
    const gridBg = dark ? '#0f3444' : '#e9f5f7'
    // On light backgrounds, darken accent/secondary for WCAG AA label contrast
    const accentLabel = dark ? accent : darkenHex(accent, 0.55)
    const secondaryLabel = dark ? secondary : darkenHex(secondary, 0.7)

    return [
      `--theme-bg: ${bg}`,
      `--theme-text: ${text}`,
      `--theme-text-muted: ${textMuted}`,
      `--theme-primary: ${primary}`,
      `--theme-primary-text: ${primaryText}`,
      `--theme-primary-text-muted: ${primaryTextMuted}`,
      `--theme-secondary: ${secondary}`,
      `--theme-accent: ${accent}`,
      `--theme-accent-label: ${accentLabel}`,
      `--theme-secondary-label: ${secondaryLabel}`,
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
        <div class="slide-frame-outer">
          <div class="slide-frame" data-theme={themeMode} style={themeStyle} bind:this={slideFrameEl}>
            <div class="slide-inner" bind:this={slideInnerEl}>
              <SlideRenderer slide={activeSlide} {editable} onEditorReady={handleEditorReady} onEditorBlur={handleEditorBlur} />
            </div>
          </div>
          {#if overflowing}
            <div class="overflow-warning" role="alert">
              Content overflows the slide — some modules won't be visible in the presentation
            </div>
          {/if}
        </div>
      {:else}
        <div class="slide-frame view-mode" data-theme={themeMode} style={themeStyle}>
          <SlideRenderer slide={activeSlide} editable={false} />
          {#if editable}
            <div
              class="click-overlay"
              role="button"
              tabindex="0"
              onclick={() => setMode('edit')}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && setMode('edit')}
            ></div>
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
    background: var(--color-bg-tertiary);
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
  .slide-frame-outer {
    width: 100%;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .slide-frame {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: white;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .slide-inner {
    width: 100%;
    height: 100%;
  }
  .no-slide {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }
  .overflow-warning {
    background: #fef3cd;
    color: #856404;
    font-size: 0.75rem;
    text-align: center;
    padding: 4px 12px;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    margin-top: -1px;
    max-width: 960px;
    width: 100%;
    border: 1px solid #ffc107;
    border-top: none;
  }
</style>
