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
    { type: 'viz', label: 'Visualization', icon: '∿' },
  ]

  function getDefaultData(type: string): Record<string, unknown> {
    switch (type) {
      case 'heading':
        return { text: '', level: 2 }
      case 'text':
        return { body: '' }
      case 'card':
        return { title: '', body: '', accent: '' }
      case 'label':
        return { text: '', color: '' }
      case 'tip-box':
        return { title: '', body: '', variant: 'info' }
      case 'prompt-block':
        return { code: '', language: '' }
      case 'image':
        return { src: '', alt: '', caption: '' }
      case 'carousel':
        return { items: [] }
      case 'comparison':
        return { left: { title: '', items: [] }, right: { title: '', items: [] } }
      case 'card-grid':
        return { cards: [] }
      case 'flow':
        return { steps: [] }
      case 'stream-list':
        return { items: [] }
      case 'viz':
        return { viz: 'lorenz' }
      default:
        return {}
    }
  }

  async function addModule(type: string) {
    if (adding) return
    adding = true

    const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

    try {
      const res = await fetch(`${API_URL}/api/decks/${deckId}/slides/${slideId}/blocks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, zone, data: getDefaultData(type) }),
      })

      if (res.ok) {
        onAdd()
      }
    } catch (err) {
      console.error('Failed to add module:', err)
    } finally {
      adding = false
    }
  }
</script>

<div class="module-picker">
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
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 8px;
    z-index: 50;
    min-width: 220px;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .picker-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    color: var(--color-text, #1f2937);
  }

  .picker-item:hover {
    background: #f3f4f6;
    border-color: var(--color-border, #e5e7eb);
  }

  .picker-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .picker-icon {
    font-size: 16px;
    line-height: 1.2;
  }

  .picker-label {
    font-size: 10px;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
