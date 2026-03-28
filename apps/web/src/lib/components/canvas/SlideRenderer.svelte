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
    padding: 2rem;
    display: flex;
    flex-direction: column;
  }
  .slide[data-slide-type="title"] {
    background: linear-gradient(135deg, var(--navy) 0%, var(--blue-hover) 100%);
    color: white;
  }
  .slide[data-slide-type="section-divider"] {
    background: var(--color-bg-secondary);
  }
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }
  .slide-content {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .layout-title {
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 1.5rem;
  }
  .layout-section {
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 1rem;
  }
  .layout-section :global(.heading) {
    font-size: 2rem;
  }
  .layout-body {
    align-items: flex-start;
    justify-content: flex-start;
    gap: 1rem;
  }
  .layout-resources {
    align-items: flex-start;
    justify-content: flex-start;
    gap: 0.6rem;
  }
</style>
