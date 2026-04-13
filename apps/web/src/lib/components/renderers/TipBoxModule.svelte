<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import { renderContent } from '$lib/utils/markdown'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let renderedContent = $derived(renderContent(typeof data.content === 'string' ? data.content : ''))
  let title = $derived(typeof data.title === 'string' ? data.title : '')

  let editorActive = $state(false)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  function handleRichTextChange(html: string) {
    editContent = html
    onchange?.({ ...data, content: html })
  }
</script>

<div class="tip-box">
  {#if title}
    <strong>{title}</strong>
  {/if}
  <div class="tip-box-content">
    {#if editable && editorActive}
      <RichTextEditor
        content={editContent}
        {editable}
        placeholder="Tip content..."
        onchange={handleRichTextChange}
        {oneditorready}
        {oneditorblur}
        initialClickCoords={clickCoords}
      />
    {:else if editable}
      <button
        type="button"
        class="tip-preview editable"
        onclick={(e) => { clickCoords = { x: e.clientX, y: e.clientY }; editContent = renderedContent; editorActive = true }}
        onkeydown={(e) => { if (e.key === 'Enter') { editContent = renderedContent; editorActive = true } }}
      >
        {#if renderedContent}{@html renderedContent}{:else}<span class="placeholder-text">Tip content...</span>{/if}
      </button>
    {:else}
      {@html renderedContent}
    {/if}
  </div>
</div>

<style>
  .tip-box {
    background: rgba(100, 181, 246, 0.05);
    border: 1px solid rgba(100, 181, 246, 0.12);
    border-radius: 8px;
    padding: clamp(14px, 2.5cqi, 20px) clamp(16px, 3cqi, 24px);
    font-family: var(--font-body);
  }
  .tip-box strong {
    display: block;
    font-weight: 500;
    color: var(--accent-cyan, #64b5f6);
    margin-bottom: 6px;
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
  }
  .tip-box-content {
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
    line-height: 1.6;
    color: var(--text-muted, rgba(240, 240, 240, 0.65));
  }
  .tip-preview.editable {
    cursor: text;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    text-align: inherit;
    width: 100%;
    display: block;
  }
  .tip-box-content :global(.tiptap-mount) {
    padding-inline: 12px;
  }
  .placeholder-text {
    opacity: 0.4;
    font-style: italic;
  }
</style>
