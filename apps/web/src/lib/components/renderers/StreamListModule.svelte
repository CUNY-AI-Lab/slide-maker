<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import { inlineMarkdown } from '$lib/utils/markdown'
  import DOMPurify from 'dompurify'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let items: string[] = $derived(
    Array.isArray(data.items)
      ? data.items.map((item: unknown) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const o = item as Record<string, unknown>
            return String(o.text || o.content || o.label || o.title || JSON.stringify(item))
          }
          return String(item)
        })
      : []
  )

  let activeItemIndex: number | null = $state(null)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  function handleItemChange(index: number, html: string) {
    editContent = html
    const newItems = [...items]
    newItems[index] = html
    onchange?.({ ...data, items: newItems })
  }
</script>

<ul class="stream-list">
  {#each items as item, i}
    <li>
      {#if editable && activeItemIndex === i}
        <RichTextEditor
          content={editContent}
          {editable}
          placeholder="List item..."
          onchange={(html) => handleItemChange(i, html)}
          {oneditorready}
          {oneditorblur}
          initialClickCoords={clickCoords}
        />
      {:else if editable}
        <button
          type="button"
          class="item-preview"
          onclick={(e) => { clickCoords = { x: e.clientX, y: e.clientY }; editContent = item; activeItemIndex = i }}
        >{@html DOMPurify.sanitize(inlineMarkdown(item))}</button>
      {:else}
        {@html DOMPurify.sanitize(inlineMarkdown(item))}
      {/if}
    </li>
  {/each}
</ul>

<style>
  .stream-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-family: var(--font-body);
  }
  .stream-list li {
    padding: clamp(8px, 1.5cqi, 12px) clamp(12px, 2cqi, 16px);
    border-left: 2px solid var(--accent-cyan, #64b5f6);
    margin-bottom: clamp(4px, 0.8cqi, 6px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-radius: 0 6px 6px 0;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.5;
    color: var(--text-muted, rgba(240, 240, 240, 0.65));
  }
  .item-preview {
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
  .stream-list li :global(.tiptap),
  .stream-list li :global(.tiptap p) {
    font-size: inherit;
    line-height: inherit;
    font-family: inherit;
    margin: 0;
  }
</style>
