<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import DOMPurify from 'dompurify'
  import { renderRichTextData } from '@slide-maker/shared'

  import type { Editor } from '@tiptap/core'
  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: { data: Record<string, unknown>; editable: boolean; onchange?: (newData: Record<string, unknown>) => void; oneditorready?: (editor: Editor) => void; oneditorblur?: () => void } = $props()

  let column = $derived(typeof data.column === 'string' ? data.column : '')

  let editorActive = $state(false)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  let renderedHtml = $derived(renderRichTextData(data, (html) => DOMPurify.sanitize(html, { ADD_ATTR: ['style'] })))

  function handleRichTextChange(html: string) {
    editContent = html
    onchange?.({ ...data, html })
  }
</script>

<div
  class="text-block"
  class:column-left={column === 'left'}
  class:column-right={column === 'right'}
>
  {#if editable && editorActive}
    <RichTextEditor
      content={editContent}
      {editable}
      placeholder="Type text here..."
      onchange={handleRichTextChange}
      {oneditorready}
      {oneditorblur}
      initialClickCoords={clickCoords}
    />
  {:else}
    {#if editable}
      <button
        type="button"
        class="text-preview editable"
        onclick={(e) => { clickCoords = { x: e.clientX, y: e.clientY }; editContent = renderedHtml; editorActive = true }}
        onkeydown={(e) => { if (e.key === 'Enter') { editContent = renderedHtml; editorActive = true } }}
      >
        {@html renderedHtml}
      </button>
    {:else}
      <div class="text-preview">{@html renderedHtml}</div>
    {/if}
  {/if}
</div>

<style>
  .text-block {
    font-family: var(--font-body);
    /* Inherit typography from framework CSS for parity */
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    outline: none;
  }
  .text-block :global(a) {
    color: var(--accent-cyan, #64b5f6);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .text-block :global(a:hover) {
    text-decoration-thickness: 2px;
  }
  .text-block :global(strong) {
    font-weight: 600;
  }
  .text-block :global(ul), .text-block :global(ol) {
    padding-left: 1.5em;
    margin: 0.4em 0;
  }
  .text-block :global(li) {
    margin-bottom: 0.5em;
  }
  .text-block :global(p) {
    margin: 0.5em 0;
  }
  .text-block :global(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.88em;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  }
  .column-left { text-align: left; }
  .column-right { text-align: right; }
  .text-preview.editable {
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
  /* Match preview padding so text doesn't shift left when editor activates */
  .text-block :global(.tiptap-mount) {
    padding-inline: 12px;
  }
</style>
