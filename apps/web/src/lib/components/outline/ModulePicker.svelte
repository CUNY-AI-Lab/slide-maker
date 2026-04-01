<script lang="ts">
  let {
    deckId,
    slideId,
    zone,
    onAdd,
  }: {
    deckId: string
    slideId: string
    zone: string
    onAdd: () => void
  } = $props()

  let adding = $state(false)

  const moduleTypes = [
    { type: 'heading', label: 'Heading', icon: 'H' },
    { type: 'text', label: 'Text', icon: '¶' },
    { type: 'card', label: 'Card', icon: '▭' },
    { type: 'label', label: 'Label', icon: '◉' },
    { type: 'tip-box', label: 'Callout', icon: '💡' },
    { type: 'prompt-block', label: 'Code Block', icon: '⌨' },
    { type: 'image', label: 'Image', icon: '🖼' },
    { type: 'carousel', label: 'Carousel', icon: '⟳' },
    { type: 'comparison', label: 'Comparison', icon: '⟺' },
    { type: 'card-grid', label: 'Card Grid', icon: '▦' },
    { type: 'flow', label: 'Process Flow', icon: '↓' },
    { type: 'stream-list', label: 'List', icon: '☰' },
  ]

  function getDefaultData(type: string): Record<string, unknown> {
    switch (type) {
      case 'heading':
        return { text: 'New heading', level: 2 }
      case 'text':
        return { text: '' }
      case 'card':
        return { content: 'New card' }
      case 'label':
        return { text: 'Label', color: 'cyan' }
      case 'tip-box':
        return { content: '', title: 'Note' }
      case 'prompt-block':
        return { content: '', language: '' }
      case 'image':
        return { src: '', alt: '', caption: '' }
      case 'carousel':
        return { items: [] }
      case 'comparison':
        return { panels: [{ title: 'Option A', content: 'Describe this approach...' }, { title: 'Option B', content: 'Describe this approach...' }] }
      case 'card-grid':
        return { cards: [] }
      case 'flow':
        return { nodes: [] }
      case 'stream-list':
        return { items: [] }
      default:
        return {}
    }
  }

  import { applyMutation } from '$lib/utils/mutations'

  async function addModule(type: string) {
    if (adding) return
    adding = true

    try {
      await applyMutation({
        action: 'addBlock',
        payload: { slideId, block: { type, zone, data: getDefaultData(type) } },
      })
      onAdd()
    } catch (err) {
      console.error('Failed to add module:', err)
    } finally {
      adding = false
    }
  }
</script>

<div class="module-picker" aria-live="polite">
  <div class="picker-grid">
    {#each moduleTypes as mod}
      <button
        class="picker-item"
        onclick={() => addModule(mod.type)}
        disabled={adding}
        title={mod.label}
      >
        <span class="picker-icon">{mod.icon}</span>
        <span class="picker-label">{mod.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .module-picker {
    background: white;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
    padding: 10px;
    z-index: 50;
    min-width: 260px;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .picker-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    color: var(--color-text, #1f2937);
    min-height: 48px; /* Larger tap target */
  }

  .picker-item:hover { background: #f3f4f6; border-color: var(--color-border, #e5e7eb); }
  .picker-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  .picker-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .picker-icon {
    font-size: 18px;
    line-height: 1.2;
  }

  .picker-label {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
