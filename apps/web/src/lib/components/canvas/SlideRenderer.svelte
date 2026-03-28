<script lang="ts">
  import BlockRenderer from '$lib/components/renderers/BlockRenderer.svelte'
  import BlockWrapper from './BlockWrapper.svelte'
  import { updateSlideInDeck } from '$lib/stores/deck'

  import type { Editor } from '@tiptap/core'

  let { slide, editable = false, onEditorReady }: {
    slide: {
      id: string;
      deckId: string;
      type: string;
      layout?: string;
      blocks: Array<{ id: string; type: string; data: Record<string, unknown>; layout?: { x: number; y: number; width: number; height: number } | null; order: number }>;
    };
    editable: boolean;
    onEditorReady?: (editor: Editor) => void;
  } = $props()

  let sortedBlocks = $derived(
    [...slide.blocks].sort((a, b) => a.order - b.order)
  )

  let slideType = $derived(slide.type ?? 'body')
  let slideLayout = $derived(slide.layout ?? 'single')

  let leftBlocks = $derived(
    sortedBlocks.filter((b) => (b.data as Record<string, unknown>).column !== 'right')
  )
  let rightBlocks = $derived(
    sortedBlocks.filter((b) => (b.data as Record<string, unknown>).column === 'right')
  )

  const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

  async function handleLayoutChange(blockId: string, layout: { x: number; y: number; width: number; height: number }) {
    // Update store
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) => b.id === blockId ? { ...b, layout } : b),
    }))
    // Persist to API
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${blockId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    }).catch(console.error)
  }

  function handleDataChange(blockId: string, newData: Record<string, unknown>) {
    // Update store
    updateSlideInDeck(slide.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) => b.id === blockId ? { ...b, data: newData } : b),
    }))
    // Persist to API
    fetch(`${API_URL}/api/decks/${slide.deckId}/slides/${slide.id}/blocks/${blockId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: newData }),
    }).catch(console.error)
  }
</script>

<div class="slide" data-slide-type={slideType}>
  {#if sortedBlocks.length === 0}
    <div class="empty-state">
      Empty slide — use the chat to add content
    </div>
  {:else if slideLayout !== 'single'}
    <div class="slide-content" class:layout-title={slideType === 'title'} class:layout-section={slideType === 'section-divider'} class:layout-body={slideType === 'body'} class:layout-resources={slideType === 'resources'}>
      <div class="slide-columns" class:two-col={slideLayout === 'two-column'}
           class:wide-left={slideLayout === 'two-column-wide-left'}
           class:wide-right={slideLayout === 'two-column-wide-right'}>
        <div class="col col-left">
          {#each leftBlocks as block (block.id)}
            {#if editable}
              <BlockWrapper {block} onLayoutChange={handleLayoutChange}>
                <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
              </BlockWrapper>
            {:else}
              <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
            {/if}
          {/each}
        </div>
        <div class="col col-right">
          {#each rightBlocks as block (block.id)}
            {#if editable}
              <BlockWrapper {block} onLayoutChange={handleLayoutChange}>
                <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
              </BlockWrapper>
            {:else}
              <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
            {/if}
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="slide-content" class:layout-title={slideType === 'title'} class:layout-section={slideType === 'section-divider'} class:layout-body={slideType === 'body'} class:layout-resources={slideType === 'resources'}>
      {#each sortedBlocks as block (block.id)}
        {#if editable}
          <BlockWrapper {block} onLayoutChange={handleLayoutChange}>
            <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
          </BlockWrapper>
        {:else}
          <BlockRenderer {block} {editable} onDataChange={handleDataChange} {onEditorReady} />
        {/if}
      {/each}
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

  /* Title slide: navy gradient, white text, centered */
  .slide[data-slide-type="title"] {
    background: linear-gradient(135deg, var(--navy) 0%, var(--blue-hover) 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 3rem);
  }

  /* Section divider: teal/blue gradient, white text, centered */
  .slide[data-slide-type="section-divider"] {
    background: linear-gradient(135deg, var(--teal) 0%, var(--blue) 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 3rem);
  }

  /* Body slide: light background, left-aligned */
  .slide[data-slide-type="body"] {
    background: white;
    color: var(--stone);
    padding: clamp(1.25rem, 3vw, 2.5rem);
  }

  /* Resources slide: compact layout */
  .slide[data-slide-type="resources"] {
    background: white;
    color: var(--stone);
    padding: clamp(1rem, 2.5vw, 2rem);
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: clamp(0.8rem, 1.2vw, 0.95rem);
    font-style: italic;
  }

  .slide-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
  }

  /* Title layout: centered flex with generous spacing */
  .layout-title {
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: clamp(1rem, 2.5vw, 2rem);
  }

  /* Section divider layout: centered, large heading */
  .layout-section {
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: clamp(0.75rem, 2vw, 1.5rem);
  }

  /* Body layout: left-aligned with clear hierarchy */
  .layout-body {
    align-items: flex-start;
    justify-content: flex-start;
    gap: clamp(0.6rem, 1.5vw, 1.25rem);
  }

  /* Resources layout: compact list-oriented */
  .layout-resources {
    align-items: flex-start;
    justify-content: flex-start;
    gap: clamp(0.35rem, 1vw, 0.6rem);
  }

  /* Multi-column layouts */
  .slide-columns { display: grid; gap: clamp(1rem, 2vw, 2rem); height: 100%; }
  .two-col { grid-template-columns: 1fr 1fr; }
  .wide-left { grid-template-columns: 3fr 2fr; }
  .wide-right { grid-template-columns: 2fr 3fr; }
  .col { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
</style>
