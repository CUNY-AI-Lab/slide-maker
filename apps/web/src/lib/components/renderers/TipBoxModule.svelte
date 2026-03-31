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
    <div class="tip-box-title">{title}</div>
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
    background: rgba(121, 192, 255, 0.1);
    border-left: 4px solid #79c0ff;
    padding: clamp(0.75rem, 1.5cqi, 1.25rem);
    border-radius: 0 6px 6px 0;
    font-family: var(--font-body);
  }
  .tip-box-title {
    font-weight: 700;
    color: #79c0ff;
    margin-bottom: 0.35rem;
    font-size: clamp(0.8rem, 1.2cqi, 0.95rem);
  }
  .tip-box-content {
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.6;
  }
</style>
