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

  let title = $derived(typeof data.title === 'string' ? data.title : '')
  let content = $derived(renderContent(typeof data.body === 'string' ? data.body : typeof data.content === 'string' ? data.content : ''))
  let variant = $derived(typeof data.variant === 'string' ? data.variant : 'default')

  function handleRichTextChange(html: string) {
    onchange?.({ ...data, content: html })
  }
</script>

<div class="card" class:card-navy={variant === 'navy'} class:card-cyan={variant === 'cyan'}>
  {#if title}
    <h3>{title}</h3>
  {/if}
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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: clamp(16px, 3cqi, 24px);
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
    line-height: 1.45;
    font-family: var(--font-body);
    color: rgba(240, 240, 240, 0.65);
  }
  .card h3 {
    font-size: clamp(0.95rem, 1.6cqi, 1.3rem);
    margin: 0 0 8px 0;
    font-family: var(--font-display);
  }
  .card-navy {
    border-left: 3px solid var(--accent-navy, #1e3a5f);
  }
  .card-cyan {
    border-left: 3px solid var(--accent-cyan, #64b5f6);
  }
</style>
