<script lang="ts">
  let { block }: { block: { id: string; type: string; data: Record<string, unknown> } } = $props()

  const typeLabels: Record<string, string> = {
    heading: 'Heading',
    text: 'Text',
    image: 'Image',
    card: 'Card',
    label: 'Label',
    'tip-box': 'Tip Box',
    'prompt-block': 'Prompt Block',
    carousel: 'Carousel',
    comparison: 'Comparison',
    'card-grid': 'Card Grid',
    flow: 'Flow',
    'stream-list': 'Stream List',
  }

  let label = $derived(typeLabels[block.type] ?? block.type)
</script>

<div class="block-item">
  <span class="drag-handle">{'\u283F'}</span>
  <span class="block-label">{label}</span>
</div>

<style>
  .block-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px 2px 20px;
    font-size: 11px;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.4;
  }

  .drag-handle {
    cursor: grab;
    color: var(--color-text-muted, #9ca3af);
    font-size: 12px;
    user-select: none;
  }

  .block-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
