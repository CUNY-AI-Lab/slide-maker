<script lang="ts">
  import HeadingBlock from './HeadingBlock.svelte'
  import TextBlock from './TextBlock.svelte'
  import ImageBlock from './ImageBlock.svelte'
  import CodeBlock from './CodeBlock.svelte'
  import QuoteBlock from './QuoteBlock.svelte'
  import StepsBlock from './StepsBlock.svelte'
  import CardGridBlock from './CardGridBlock.svelte'
  import EmbedBlock from './EmbedBlock.svelte'

  let { block, editable = false }: {
    block: { id: string; type: string; data: Record<string, unknown>; fragmentOrder?: number | null };
    editable: boolean;
  } = $props()

  const rendererMap: Record<string, any> = {
    heading: HeadingBlock,
    text: TextBlock,
    image: ImageBlock,
    code: CodeBlock,
    quote: QuoteBlock,
    steps: StepsBlock,
    'card-grid': CardGridBlock,
    embed: EmbedBlock
  }

  let Renderer = $derived(rendererMap[block.type] ?? null)
</script>

<div class="block-wrapper" class:editable class:is-fragment={block.fragmentOrder != null}>
  {#if block.fragmentOrder != null}
    <span class="fragment-badge">Step {block.fragmentOrder + 1}</span>
  {/if}
  {#if Renderer}
    <Renderer data={block.data} {editable} />
  {:else}
    <div class="unknown-block">Unknown block type: {block.type}</div>
  {/if}
</div>

<style>
  .block-wrapper {
    position: relative;
    width: 100%;
  }
  .block-wrapper.editable:hover {
    outline: 2px dashed var(--color-primary);
    outline-offset: 4px;
    border-radius: var(--radius-sm);
  }
  .is-fragment {
    opacity: 0.7;
    border-left: 3px solid var(--teal, #2FB8D6);
    padding-left: 8px;
  }
  .fragment-badge {
    position: absolute;
    top: -10px;
    right: 4px;
    background: var(--teal, #2FB8D6);
    color: white;
    font-size: 10px;
    padding: 1px 8px;
    border-radius: 10px;
    font-weight: 600;
    font-family: var(--font-body);
    z-index: 5;
  }
  .unknown-block {
    padding: 0.5rem;
    background: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 0.8rem;
    text-align: center;
  }
</style>
