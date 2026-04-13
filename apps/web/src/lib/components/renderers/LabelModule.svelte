<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import DOMPurify from 'dompurify'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let color = $derived(typeof data.color === 'string' ? data.color : 'cyan')

  let editorActive = $state(false)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  let sanitizedText = $derived(DOMPurify.sanitize(text))

  function handleRichTextChange(html: string) {
    editContent = html
    onchange?.({ ...data, text: html })
  }
</script>

<div class="label-wrapper label-{color}">
  {#if editable && editorActive}
    <RichTextEditor
      content={editContent}
      {editable}
      placeholder="Label..."
      onchange={handleRichTextChange}
      {oneditorready}
      {oneditorblur}
      initialClickCoords={clickCoords}
    />
  {:else if editable}
    <button
      type="button"
      class="label-preview label label-{color}"
      onclick={(e) => { clickCoords = { x: e.clientX, y: e.clientY }; editContent = sanitizedText || text; editorActive = true }}
    >{@html sanitizedText || text}</button>
  {:else}
    <span class="label label-{color}">{@html sanitizedText}</span>
  {/if}
</div>

<style>
  .label-wrapper {
    display: inline-block;
  }
  .label, .label-preview {
    display: inline-block;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    background: none;
    border-radius: 4px;
    outline: none;
    font-family: var(--font-body);
    min-width: 3em;
    min-height: 1.5em;
    line-height: 1.5;
  }
  .label-preview {
    cursor: text;
    border: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
  }
  /* TipTap content inherits label styling */
  .label-wrapper :global(.tiptap-mount) {
    padding-inline: 10px;
  }
  .label-wrapper :global(.tiptap),
  .label-wrapper :global(.tiptap p) {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-family: var(--font-body);
    line-height: 1.5;
    margin: 0;
  }
  .label-cyan, .label-wrapper.label-cyan :global(.tiptap), .label-wrapper.label-cyan :global(.tiptap p) { color: #79c0ff; }
  .label-blue, .label-wrapper.label-blue :global(.tiptap), .label-wrapper.label-blue :global(.tiptap p) { color: var(--blue, #3B73E6); }
  .label-navy, .label-wrapper.label-navy :global(.tiptap), .label-wrapper.label-navy :global(.tiptap p) { color: #7b9fd4; }
  .label-red, .label-wrapper.label-red :global(.tiptap), .label-wrapper.label-red :global(.tiptap p) { color: #ff6b6b; }
  .label-amber, .label-wrapper.label-amber :global(.tiptap), .label-wrapper.label-amber :global(.tiptap p) { color: #d4a017; }
  .label-green, .label-wrapper.label-green :global(.tiptap), .label-wrapper.label-green :global(.tiptap p) { color: #2d8a4e; }
</style>
