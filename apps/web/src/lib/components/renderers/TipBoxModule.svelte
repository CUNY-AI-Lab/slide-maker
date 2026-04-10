<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import { renderContent } from '$lib/utils/markdown'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
  } = $props()

  let content = $derived(renderContent(typeof data.content === 'string' ? data.content : ''))
  let title = $derived(typeof data.title === 'string' ? data.title : '')

  function handleRichTextChange(html: string) {
    onchange?.({ ...data, content: html })
  }
</script>

<div class="tip-box">
  {#if title}
    <strong>{title}</strong>
  {/if}
  <div class="tip-box-content">
    {#if editable}
      <RichTextEditor
        content={content}
        {editable}
        placeholder="Tip content..."
        onchange={handleRichTextChange}
        {oneditorready}
      />
    {:else}
      {@html content}
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
  }
</style>
