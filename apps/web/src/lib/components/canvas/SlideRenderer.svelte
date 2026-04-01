<script lang="ts">
  import ZoneDrop from './ZoneDrop.svelte'
  import SplitHandle from './SplitHandle.svelte'
  import { currentDeck, updateSlideInDeck } from '$lib/stores/deck'
  import { get } from 'svelte/store'
  import type { Editor } from '@tiptap/core'
  import { API_URL } from '$lib/api'

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
  } = $props()

  let splitRatio = $state(parseFloat(String(slide.splitRatio ?? '0.5')))

  $effect(() => {
    splitRatio = parseFloat(String(slide.splitRatio ?? '0.5'))
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
    const deck = get(currentDeck)
    const meta = deck?.metadata as Record<string, unknown> | undefined
    if (!meta?.branding) return null
    const b = meta.branding as { logo?: string; position?: string }
    if (!b.logo) return null
    return b
  })

  function handleReorder(zone: string, items: Module[]) {
    const reordered = items.map((item, i) => ({ ...item, order: i, zone }))
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: [
        ...s.blocks.filter((b) => b.zone !== zone),
        ...reordered,
      ] as typeof s.blocks,
    }))
    // Persist order to API
    for (const item of reordered) {
      fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${item.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: item.order }),
      }).catch(console.error)
    }
  }

  function handleModuleDataChange(moduleId: string, newData: Record<string, unknown>) {
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === moduleId ? { ...b, data: newData } : b
      ),
    }))
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${moduleId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: newData }),
    }).catch(console.error)
  }

  function handleModuleStepChange(moduleId: string, stepOrder: number | null) {
    // Harden: clamp step values to a safe range [0, 8]
    const MAX_STEP = 8
    const normalized = stepOrder == null ? null : Math.max(0, Math.min(MAX_STEP, Number(stepOrder)))
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === moduleId ? { ...b, stepOrder: normalized } : b
      ),
    }))
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${moduleId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepOrder: normalized }),
    }).catch(console.error)
  }

  function handleModuleDelete(moduleId: string) {
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== moduleId),
    }))
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${moduleId}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(console.error)
  }

  function handleRatioChange(newRatio: number) {
    splitRatio = newRatio
    updateSlideInDeck(slide.id, (s) => ({ ...s, splitRatio: String(newRatio) }))
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitRatio: String(newRatio) }),
    }).catch(console.error)
  }
</script>

<div class="slide" data-layout={layoutType}>
  {#if branding}
    <img
      class="branding-logo {branding.position ?? 'top-left'}"
      src={branding.logo}
      alt="Logo"
    />
  {/if}
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
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
        {onEditorReady}
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
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
          {onEditorReady}
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
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
          {onEditorReady}
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
          onModuleDelete={handleModuleDelete}
          onModuleStepChange={handleModuleStepChange}
        {onEditorReady}
      />
    </div>
  {/if}
</div>

<style>
  .slide {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: auto;
    font-family: var(--font-body);
    box-sizing: border-box;
    position: relative;
    container-type: inline-size;
  }

  /* ── Padding: scaled for the ~700px edit canvas ── */
  .slide[data-layout="title-slide"],
  .slide[data-layout="layout-divider"],
  .slide[data-layout="closing-slide"],
  .slide[data-layout="layout-split"],
  .slide[data-layout="layout-content"],
  .slide[data-layout="layout-grid"],
  .slide[data-layout="layout-full-dark"] {
    padding: clamp(1rem, 3cqi, 32px) clamp(1.25rem, 4cqi, 40px);
  }

  /* ── Zone containers ── */
  .zone-centered {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: clamp(1rem, 2.5cqi, 2rem);
  }

  .zone-split {
    flex: 1;
    display: flex;
    flex-direction: row;
    gap: clamp(0.75rem, 2cqi, 20px);
    position: relative;
    min-height: 0;
    align-items: stretch;
  }

  .zone-left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    overflow: auto;
    gap: 16px;
  }

  .zone-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 0;
    overflow: auto;
    gap: 16px;
  }

  .zone-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(1rem, 2cqi, 24px);
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
