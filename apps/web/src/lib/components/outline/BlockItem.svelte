<script lang="ts">
  import { get } from 'svelte/store'
  import { currentDeck, updateSlideInDeck } from '$lib/stores/deck'
  import { API_URL } from '$lib/api'

  let { block, slideId }: {
    block: { id: string; type: string; data: Record<string, unknown>; slideId?: string }
    slideId?: string
  } = $props()

  let deleting = $state(false)

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
    artifact: 'Artifact',
  }

  let label = $derived(typeLabels[block.type] ?? block.type)
  let expanded = $state(false)

  function persistData(newData: Record<string, unknown>) {
    const sid = slideId ?? block.slideId
    if (!sid) return
    const deck = get(currentDeck)
    if (!deck) return

    updateSlideInDeck(sid, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === block.id ? { ...b, data: { ...b.data, ...newData } } : b
      ),
    }))

    fetch(`${API_URL}/api/decks/${deck.id}/slides/${sid}/blocks/${block.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { ...block.data, ...newData } }),
    }).catch(console.error)
  }

  function handleTextInput(field: string, e: Event) {
    const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value
    persistData({ [field]: val })
  }

  function handleSelectInput(field: string, e: Event) {
    const val = (e.target as HTMLSelectElement).value
    persistData({ [field]: field === 'level' ? Number(val) : val })
  }

  /** Strip markdown syntax for plain-text preview */
  function stripMd(s: string): string {
    return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^#+\s*/gm, '').replace(/<[^>]+>/g, '')
  }

  // Derive a preview string from the data
  let preview = $derived.by(() => {
    const d = block.data
    if (block.type === 'heading') return String(d.text || '').slice(0, 40) || 'Untitled'
    if (block.type === 'label') return String(d.text || '').slice(0, 30) || 'Label'
    if (block.type === 'text') return stripMd(String(d.markdown || d.text || d.html || '')).slice(0, 40) || 'Empty text'
    if (block.type === 'image') return String(d.alt || d.src || '').slice(0, 30) || 'Image'
    if (block.type === 'card') return stripMd(String(d.content || d.title || '')).slice(0, 30) || 'Card'
    if (block.type === 'artifact') return String(d.alt || d.name || '').slice(0, 30) || 'Visualization'
    return ''
  })

  const LABEL_COLORS = ['cyan', 'blue', 'navy', 'red', 'amber', 'green']

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    deleting = true

    const sid = slideId ?? block.slideId
    if (!sid) { deleting = false; return }
    const deck = get(currentDeck)
    if (!deck) { deleting = false; return }

    try {
      const res = await fetch(`${API_URL}/api/decks/${deck.id}/slides/${sid}/blocks/${block.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        updateSlideInDeck(sid, (s) => ({
          ...s,
          blocks: s.blocks.filter((b) => b.id !== block.id),
        }))
      }
    } catch (err) {
      console.error('Failed to delete block:', err)
    }
    deleting = false
  }
</script>

<div class="block-item">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="block-header" onclick={(e) => { if (!(e.target as HTMLElement).closest('.delete-block-btn')) expanded = !expanded }} onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)} role="button" tabindex="0">
    <span class="drag-handle">{'\u283F'}</span>
    <span class="block-label">{label}</span>
    {#if preview}
      <span class="block-preview">{preview}</span>
    {/if}
    <span class="expand-arrow">{expanded ? '\u25BC' : '\u25B6'}</span>
    <button
      class="delete-block-btn"
      type="button"
      onclick={handleDelete}
      disabled={deleting}
      aria-label="Delete module"
      title="Delete module"
    >
      {'\u2715'}
    </button>
  </div>

  {#if expanded}
    <div class="block-fields" onclick={(e) => e.stopPropagation()}>
      {#if block.type === 'heading'}
        <input
          class="field-input"
          type="text"
          value={String(block.data.text ?? '')}
          placeholder="Heading text"
          oninput={(e) => handleTextInput('text', e)}
        />
        <select
          class="field-select"
          value={String(block.data.level ?? '2')}
          onchange={(e) => handleSelectInput('level', e)}
          aria-label="Heading level"
        >
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
        </select>
      {:else if block.type === 'label'}
        <input
          class="field-input"
          type="text"
          value={String(block.data.text ?? '')}
          placeholder="Label text"
          oninput={(e) => handleTextInput('text', e)}
        />
        <select
          class="field-select"
          value={String(block.data.color ?? 'cyan')}
          onchange={(e) => handleSelectInput('color', e)}
          aria-label="Label color"
        >
          {#each LABEL_COLORS as color}
            <option value={color}>{color}</option>
          {/each}
        </select>
      {:else if block.type === 'text'}
        <textarea
          class="field-textarea"
          value={stripMd(String(block.data.html || block.data.markdown || block.data.text || ''))}
          placeholder="Text content"
          oninput={(e) => handleTextInput('markdown', e)}
          rows="3"
        ></textarea>
      {:else if block.type === 'image'}
        <input
          class="field-input"
          type="text"
          value={String(block.data.src ?? '')}
          placeholder="Image URL"
          oninput={(e) => handleTextInput('src', e)}
        />
      {:else if block.type === 'card'}
        <input
          class="field-input"
          type="text"
          value={String(block.data.title ?? '')}
          placeholder="Card title"
          oninput={(e) => handleTextInput('title', e)}
        />
      {:else}
        <span class="edit-hint">Edit on canvas</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .block-item {
    display: flex;
    flex-direction: column;
    padding: 0 8px 0 16px;
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.35;
  }

  .block-header {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 1px 0;
    text-align: left;
    width: 100%;
    color: inherit;
    font-size: inherit;
  }
  .block-header:hover {
    color: var(--color-text, #374151);
  }

  .drag-handle {
    cursor: grab;
    color: var(--color-text-muted, #9ca3af);
    font-size: 14px;
    user-select: none;
    flex-shrink: 0;
  }

  .block-label { white-space: nowrap; font-weight: 600; flex-shrink: 0; font-size: 12px; }

  .block-preview { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-muted, #9ca3af); font-size: 10px; }

  .expand-arrow { font-size: 9px; color: var(--color-text-muted, #9ca3af); flex-shrink: 0; }

  .block-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px 0 4px 14px;
  }

  .field-input,
  .field-textarea {
    width: 100%;
    padding: 3px 6px;
    font-size: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 3px;
    background: white;
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
  }
  .field-input:focus,
  .field-textarea:focus {
    border-color: #3b82f6;
  }

  .field-textarea {
    resize: vertical;
    min-height: 40px;
  }

  .field-select {
    padding: 2px 4px;
    font-size: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 3px;
    background: white;
    outline: none;
  }

  .edit-hint {
    font-size: 12px;
    color: var(--color-text-muted, #9ca3af);
    font-style: italic;
  }

  .delete-block-btn {
    background: none; border: none; cursor: pointer;
    color: var(--color-text-muted, #9ca3af);
    font-size: 12px; padding: 4px; line-height: 1; flex-shrink: 0;
    border-radius: 4px;
    min-width: 20px; min-height: 20px;
    display: inline-flex; align-items: center; justify-content: center;
    transition: color 0.12s ease, transform 0.06s ease;
  }

  .block-header:hover .delete-block-btn { color: #6b7280; }

  .delete-block-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
  .delete-block-btn:active { transform: translateY(1px); }

  .delete-block-btn.confirming { color: #fff; background: #ef4444; }
  .delete-block-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
