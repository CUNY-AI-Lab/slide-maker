<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import { renderContent } from '$lib/utils/markdown'
  import DOMPurify from 'dompurify'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let columns = $derived(
    typeof data.columns === 'number' && data.columns >= 2 && data.columns <= 4
      ? data.columns
      : 3
  )

  let cards: Array<{ title: string; content: string; variant?: string; color?: string }> = $derived(
    Array.isArray(data.cards)
      ? data.cards.map((c: unknown) => {
          const card = c as Record<string, unknown>
          const body = typeof card.body === 'string' ? card.body : typeof card.content === 'string' ? card.content : ''
          return {
            title: typeof card.title === 'string' ? card.title : '',
            content: body,
            variant: typeof card.variant === 'string' ? card.variant : undefined,
            color: typeof card.color === 'string' ? card.color : undefined
          }
        })
      : []
  )

  let activeField: { cardIndex: number; field: 'title' | 'content' } | null = $state(null)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  function activateField(cardIndex: number, field: 'title' | 'content', value: string, e: MouseEvent) {
    clickCoords = { x: e.clientX, y: e.clientY }
    editContent = field === 'content' ? renderContent(value) : DOMPurify.sanitize(value)
    activeField = { cardIndex, field }
  }

  function handleFieldChange(cardIndex: number, field: 'title' | 'content', html: string) {
    editContent = html
    const newCards = cards.map((c, i) => i === cardIndex ? { ...c, [field]: html } : { ...c })
    onchange?.({ ...data, cards: newCards })
  }
</script>

<div class="card-grid" style="grid-template-columns: repeat({columns}, 1fr);">
  {#each cards as card, i}
    <div class="card" class:card-cyan={card.variant === 'cyan'} class:card-navy={card.variant === 'navy'} style={card.color && !card.variant ? `border-top: 3px solid ${card.color};` : ''}>
      {#if editable && activeField?.cardIndex === i && activeField.field === 'title'}
        <h3 class="card-title">
          <RichTextEditor
            content={editContent}
            {editable}
            placeholder="Card title..."
            onchange={(html) => handleFieldChange(i, 'title', html)}
            {oneditorready}
            {oneditorblur}
            initialClickCoords={clickCoords}
          />
        </h3>
      {:else if editable || card.title}
        <h3 class="card-title">
          <button
            type="button"
            class="field-preview"
            class:placeholder-text={editable && !card.title}
            onclick={(e) => activateField(i, 'title', card.title, e)}
            disabled={!editable}
          >{#if card.title}{@html DOMPurify.sanitize(card.title)}{:else}Card title...{/if}</button>
        </h3>
      {/if}

      {#if editable && activeField?.cardIndex === i && activeField.field === 'content'}
        <div class="card-content">
          <RichTextEditor
            content={editContent}
            {editable}
            placeholder="Card content..."
            onchange={(html) => handleFieldChange(i, 'content', html)}
            {oneditorready}
            {oneditorblur}
            initialClickCoords={clickCoords}
          />
        </div>
      {:else if editable || card.content}
        <div class="card-content">
          <button
            type="button"
            class="field-preview"
            class:placeholder-text={editable && !card.content}
            onclick={(e) => activateField(i, 'content', card.content, e)}
            disabled={!editable}
          >{#if card.content}{@html renderContent(card.content)}{:else}Card content...{/if}</button>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .card-grid {
    display: grid;
    gap: clamp(12px, 2.5cqi, 20px);
    width: 100%;
  }
  .card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: clamp(16px, 3cqi, 24px);
  }
  .card-title {
    font-family: var(--font-display);
    font-size: clamp(0.95rem, 1.6cqi, 1.3rem);
    font-weight: 650;
    line-height: 1.2;
    display: block;
    margin: 0 0 8px 0;
  }
  .card-content {
    margin: 0;
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
  }
  .field-preview {
    cursor: text;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    width: 100%;
    display: block;
    padding: 0;
    outline: none;
    line-height: inherit;
  }
  .field-preview:disabled {
    cursor: default;
  }
  .field-preview.placeholder-text {
    opacity: 0.4;
    font-style: italic;
  }
  .card-title :global(.tiptap),
  .card-title :global(.tiptap p) {
    font-family: var(--font-display);
    font-size: clamp(0.95rem, 1.6cqi, 1.3rem);
    font-weight: 650;
    line-height: 1.2;
    margin: 0;
  }
  .card-content :global(.tiptap),
  .card-content :global(.tiptap p) {
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
    margin: 0;
  }
</style>
