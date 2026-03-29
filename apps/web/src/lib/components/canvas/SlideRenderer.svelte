<script lang="ts">
  import ZoneDrop from './ZoneDrop.svelte'
  import SplitHandle from './SplitHandle.svelte'
  import { updateSlideInDeck } from '$lib/stores/deck'
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
  let heroModules = $derived(sorted.filter((m) => m.zone === 'hero'))
  let contentModules = $derived(sorted.filter((m) => m.zone === 'content'))
  let stageModules = $derived(sorted.filter((m) => m.zone === 'stage'))
  let mainModules = $derived(sorted.filter((m) => m.zone === 'main'))

  let layoutType = $derived(slide.layout ?? 'layout-content')

  const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

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
    overflow: hidden;
    font-family: var(--font-body);
    box-sizing: border-box;
  }

  /* ── Title Slide: gradient navy to teal, white text, centered ── */
  .slide[data-layout="title-slide"] {
    background: linear-gradient(135deg, var(--navy) 0%, var(--teal) 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 3rem);
  }

  /* ── Layout Divider: gradient teal to blue, centered, white ── */
  .slide[data-layout="layout-divider"] {
    background: linear-gradient(135deg, var(--teal) 0%, var(--blue) 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 3rem);
  }

  /* ── Closing Slide: gradient navy to dark ── */
  .slide[data-layout="closing-slide"] {
    background: linear-gradient(135deg, var(--navy) 0%, #0b1a3e 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 3rem);
  }

  /* ── Layout Split: flex row, light bg ── */
  .slide[data-layout="layout-split"] {
    background: white;
    color: var(--stone);
    padding: clamp(1rem, 2.5vw, 2rem);
  }

  /* ── Layout Content: standard body ── */
  .slide[data-layout="layout-content"] {
    background: white;
    color: var(--stone);
    padding: clamp(1.25rem, 3vw, 2.5rem);
  }

  /* ── Layout Grid: standard body ── */
  .slide[data-layout="layout-grid"] {
    background: white;
    color: var(--stone);
    padding: clamp(1.25rem, 3vw, 2.5rem);
  }

  /* ── Layout Full Dark: dark bg, light text ── */
  .slide[data-layout="layout-full-dark"] {
    background: #0b0e14;
    color: #e2e8f0;
    padding: clamp(1.25rem, 3vw, 2.5rem);
  }

  /* ── Zone containers ── */
  .zone-centered {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: clamp(1rem, 2.5vw, 2rem);
  }

  .zone-split {
    flex: 1;
    display: flex;
    flex-direction: row;
    gap: 0;
    position: relative;
    min-height: 0;
  }

  .zone-left,
  .zone-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: auto;
  }

  .zone-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: clamp(0.6rem, 1.5vw, 1.25rem);
  }
</style>
