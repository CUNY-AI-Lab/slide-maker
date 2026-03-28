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
    block: { type: string; data: Record<string, unknown> };
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

<div class="block-wrapper" class:editable>
  {#if Renderer}
    <Renderer data={block.data} {editable} />
  {:else}
    <div class="unknown-block">Unknown block type: {block.type}</div>
  {/if}
</div>

<style>
  .block-wrapper {
    position: relative;
  }
  .block-wrapper.editable:hover {
    outline: 1px dashed var(--color-border);
    outline-offset: 4px;
    border-radius: var(--radius-sm);
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
