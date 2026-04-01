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
  let variant = $derived(typeof data.variant === 'string' ? data.variant : 'default')

  function handleRichTextChange(html: string) {
    onchange?.({ ...data, content: html })
  }
</script>

<div class="card" class:card-navy={variant === 'navy'} class:card-cyan={variant === 'cyan'}>
  {#if editable}
    <RichTextEditor
      content={content}
      {editable}
      placeholder="Card content..."
      onchange={handleRichTextChange}
      {oneditorready}
    />
  {:else}
    {@html content}
  {/if}
</div>

<style>
  .card {
    border-left: 4px solid var(--teal, #2FB8D6);
    padding: clamp(1rem, 2.5cqi, 1.75rem);
    background: rgba(47, 184, 214, 0.06);
    border-radius: 0 8px 8px 0;
    font-size: clamp(0.95rem, 1.8cqi, 1.15rem);
    line-height: 1.65;
    font-family: var(--font-body);
    min-height: clamp(120px, 16cqi, 220px);
  }
  .card-navy {
    border-left-color: var(--navy, #1D3A83);
    background: rgba(29, 58, 131, 0.06);
  }
  .card-cyan {
    border-left-color: var(--teal, #2FB8D6);
    background: rgba(47, 184, 214, 0.06);
  }
</style>
