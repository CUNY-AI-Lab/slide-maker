<script lang="ts">
  import ZoneDrop from './ZoneDrop.svelte'
  import SplitHandle from './SplitHandle.svelte'
import { currentDeck, updateSlideInDeck } from '$lib/stores/deck'
import { applyMutation, apiCall } from '$lib/utils/mutations'
  import type { Editor } from '@tiptap/core'

  type Module = {
    id: string
    type: string
    data: Record<string, unknown>
    zone: string
    order: number
    stepOrder?: number | null
  }

  let {
    slide,
    editable = false,
    onEditorReady,
    onEditorBlur,
  }: {
    slide: {
      id: string
      deckId: string
      layout: string
      splitRatio?: string
      blocks: Module[]
    }
    editable?: boolean
    onEditorReady?: (editor: unknown) => void
    onEditorBlur?: () => void
  } = $props()

  // ── Auto-scale: shrink content to fit the 16:9 viewport ──────────
  let slideEl: HTMLDivElement | undefined = $state()
  let scalerEl: HTMLDivElement | undefined = $state()
  let scaleFactor = $state(1)

  $effect(() => {
    if (!scalerEl || !slideEl) return
    // Track slide.id so the effect re-runs when switching slides
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    slide.id
    let currentScale = 1
    // Reset immediately so stale scale from previous slide doesn't linger
    scaleFactor = 1
    function update() {
      const available = slideEl!.clientHeight
      const natural = scalerEl!.offsetHeight
      if (available <= 0 || natural <= 0) return
      const next = natural > available ? Math.max(0.5, available / natural) : 1
      // Guard: skip redundant updates to avoid ResizeObserver loop warnings
      if (Math.abs(next - currentScale) < 0.01) return
      currentScale = next
      scaleFactor = next
    }
    // Defer first measurement to next frame so Svelte has flushed the new content
    requestAnimationFrame(update)
    const ro = new ResizeObserver(update)
    ro.observe(scalerEl)
    return () => ro.disconnect()
  })

  let splitRatio = $state(0.45)

  $effect(() => {
    splitRatio = parseFloat(String(slide.splitRatio ?? '0.45'))
  })

  let sorted = $derived([...slide.blocks].sort((a, b) => a.order - b.order))
  let layoutType = $derived(slide.layout ?? 'layout-content')

  // For split layouts, filter by zone. For single-zone layouts, render ALL modules
  // regardless of zone (matches export behavior — prevents modules from disappearing
  // when inserted with a mismatched zone like 'stage' on a title-slide).
  let heroModules = $derived(
    ['title-slide', 'layout-divider', 'closing-slide'].includes(layoutType)
      ? sorted
      : sorted.filter((m) => m.zone === 'hero')
  )
  let contentModules = $derived(sorted.filter((m) => m.zone === 'content'))
  let stageModules = $derived(sorted.filter((m) => m.zone === 'stage'))
  let mainModules = $derived(
    ['layout-content', 'layout-grid', 'layout-full-dark'].includes(layoutType)
      ? sorted
      : sorted.filter((m) => m.zone === 'main')
  )

  // Branding from deck metadata
  let branding = $derived.by(() => {
    const deck = $currentDeck
    const meta = deck?.metadata as Record<string, unknown> | undefined
    if (!meta?.branding) return null
    const b = meta.branding as { logo?: string; position?: string }
    if (!b.logo) return null
    return b
  })

  async function handleReorder(zone: string, items: Module[]) {
    const order = items.map((m) => m.id)
    await applyMutation({ action: 'reorderBlocks', payload: { slideId: slide.id, zone, order } })
  }

  async function handleModuleResize(moduleId: string, newData: Record<string, unknown>) {
    await applyMutation({ action: 'updateBlock', payload: { slideId: slide.id, blockId: moduleId, data: newData } })
  }

  function handleModuleDataChange(moduleId: string, newData: Record<string, unknown>) {
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === moduleId ? { ...b, data: newData } : b
      ),
    }))
    apiCall(`/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${moduleId}`, 'PATCH', {
      data: newData,
    })
  }

  async function handleModuleStepChange(moduleId: string, stepOrder: number | null) {
    // Harden: clamp step values to a safe range [0, 8]
    const MAX_STEP = 8
    const normalized = stepOrder == null ? null : Math.max(0, Math.min(MAX_STEP, Number(stepOrder)))
    await applyMutation({
      action: 'updateBlockStep',
      payload: { slideId: slide.id, blockId: moduleId, stepOrder: normalized },
    })
  }

  async function handleModuleDelete(moduleId: string) {
    await applyMutation({ action: 'removeBlock', payload: { slideId: slide.id, blockId: moduleId } })
  }

  async function handleMoveToZone(blockId: string, fromZone: string, toZone: string, newOrder: string[]) {
    await applyMutation({ action: 'moveBlockToZone', payload: { slideId: slide.id, blockId, fromZone, toZone, order: newOrder } })
  }

  function handleRatioChange(newRatio: number) {
    splitRatio = newRatio
    updateSlideInDeck(slide.id, (s) => ({ ...s, splitRatio: String(newRatio) }))
    apiCall(`/api/decks/${slide.deckId}/slides/${slide.id}`, 'PATCH', {
      splitRatio: String(newRatio),
    })
  }
</script>

<div class="slide" data-layout={layoutType} bind:this={slideEl}>
  {#if branding}
    <img
      class="branding-logo {branding.position ?? 'top-left'}"
      src={branding.logo}
      alt="Logo"
    />
  {/if}
  <div
    class="slide-scaler"
    bind:this={scalerEl}
    style:transform={scaleFactor < 1 ? `scale(${scaleFactor})` : undefined}
    style:transform-origin={scaleFactor < 1 ? 'top center' : undefined}
  >
  {#if layoutType === 'title-slide' || layoutType === 'layout-divider' || layoutType === 'closing-slide'}
    <!-- Single hero zone, centered -->
    <div class="zone-centered">
      <ZoneDrop
        modules={heroModules}
        zone="hero"
        {editable}
        deckId={slide.deckId}
        slideId={slide.id}
        onReorder={handleReorder}
        onModuleDataChange={handleModuleDataChange}
        onModuleResize={handleModuleResize}
        onModuleDelete={handleModuleDelete}
        onModuleStepChange={handleModuleStepChange}
        onMoveToZone={handleMoveToZone}
        {onEditorReady}
        {onEditorBlur}
      />
    </div>
  {:else if layoutType === 'layout-split'}
    <!-- Flex row: content (left) + divider + stage (right) -->
    <div class="zone-split" style:--split-ratio={splitRatio}>
      <div class="zone-left" style:flex="{String(splitRatio)}">
        <ZoneDrop
          modules={contentModules}
          zone="content"
          {editable}
          deckId={slide.deckId}
          slideId={slide.id}
          onReorder={handleReorder}
          onModuleDataChange={handleModuleDataChange}
          onModuleResize={handleModuleResize}
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
          onMoveToZone={handleMoveToZone}
          {onEditorReady}
          {onEditorBlur}
        />
      </div>
      <SplitHandle ratio={splitRatio} onRatioChange={handleRatioChange} />
      <div class="zone-right" style:flex="{String(1 - splitRatio)}">
        <ZoneDrop
          modules={stageModules}
          zone="stage"
          {editable}
          deckId={slide.deckId}
          slideId={slide.id}
          onReorder={handleReorder}
          onModuleDataChange={handleModuleDataChange}
          onModuleResize={handleModuleResize}
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
          onMoveToZone={handleMoveToZone}
          {onEditorReady}
          {onEditorBlur}
        />
      </div>
    </div>
  {:else}
    <!-- layout-content, layout-grid, layout-full-dark: single main zone -->
    <div class="zone-main">
      <ZoneDrop
        modules={mainModules}
        zone="main"
        {editable}
        deckId={slide.deckId}
        slideId={slide.id}
        onReorder={handleReorder}
        onModuleDataChange={handleModuleDataChange}
        onModuleResize={handleModuleResize}
        onModuleDelete={handleModuleDelete}
        onModuleStepChange={handleModuleStepChange}
        onMoveToZone={handleMoveToZone}
        {onEditorReady}
        {onEditorBlur}
      />
    </div>
  {/if}
  </div>
</div>

<style>
  .slide {
    width: 100%;
    height: 100%;
    display: block;
    overflow: hidden;
    font-family: var(--font-body);
    box-sizing: border-box;
    position: relative;
    container-type: inline-size;
  }

  /* ── Auto-scale wrapper: absolute so it can grow beyond the slide ── */
  .slide-scaler {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  /* ── Padding: on the scaler so it scales with content ── */
  .slide[data-layout="title-slide"] > .slide-scaler,
  .slide[data-layout="layout-divider"] > .slide-scaler,
  .slide[data-layout="closing-slide"] > .slide-scaler,
  .slide[data-layout="layout-split"] > .slide-scaler,
  .slide[data-layout="layout-content"] > .slide-scaler,
  .slide[data-layout="layout-grid"] > .slide-scaler,
  .slide[data-layout="layout-full-dark"] > .slide-scaler {
    padding: clamp(1rem, 3cqi, 32px) clamp(1.25rem, 4cqi, 40px);
  }

  /* ── Zone containers ──
     flex: 1 0 auto → grow to fill when content is small, but never
     shrink below content height. This lets the scaler grow beyond
     min-height: 100% when content overflows, triggering auto-scale. */
  .zone-centered {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 12px;
  }

  .zone-split {
    flex: 1 0 auto;
    display: flex;
    flex-direction: row;
    gap: clamp(0.75rem, 4cqi, 40px);
    position: relative;
    min-height: 0;
    align-items: stretch;
  }

  .zone-left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    gap: 16px;
  }

  .zone-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 0;
    gap: 16px;
  }

  .zone-main {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1rem, 2cqi, 24px);
  }

  .zone-main > :global(:only-child) {
    margin-block: auto;
  }

  /* ── Branding logo ── */
  .branding-logo {
    position: absolute;
    z-index: 10;
    max-width: 80px;
    max-height: 40px;
    object-fit: contain;
    opacity: 0.85;
    pointer-events: none; /* don't block interactions or selection */
  }
  .branding-logo.top-left { top: 10px; left: 14px; }
  .branding-logo.top-right { top: 10px; right: 14px; }
  .branding-logo.bottom-left { bottom: 12px; left: 14px; }
</style>
