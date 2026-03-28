<script lang="ts">
  import BlockRenderer from '$lib/components/renderers/BlockRenderer.svelte'

  let { slide, editable = false }: {
    slide: {
      id: string;
      type: string;
      blocks: Array<{ id: string; type: string; data: Record<string, unknown>; order: number }>;
    };
    editable: boolean;
  } = $props()

  let sortedBlocks = $derived(
    [...slide.blocks].sort((a, b) => a.order - b.order)
  )

  let slideType = $derived(slide.type ?? 'body')
</script>

<div class="slide" data-slide-type={slideType}>
  {#if sortedBlocks.length === 0}
    <div class="empty-state">
      Empty slide — use the chat to add content
    </div>
  {:else}
    <div class="slide-content" class:layout-title={slideType === 'title'} class:layout-section={slideType === 'section-divider'} class:layout-body={slideType === 'body'} class:layout-resources={slideType === 'resources'}>
      {#each sortedBlocks as block (block.id)}
        <BlockRenderer {block} {editable} />
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
</style>
