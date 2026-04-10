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

  let level = $derived(typeof data.level === 'number' ? Math.min(Math.max(data.level, 1), 4) : 1)
  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let headingTag = $derived(`h${level}` as 'h1' | 'h2' | 'h3' | 'h4')

  let editorActive = $state(false)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  // Sanitize for view mode
  let sanitizedText = $derived(DOMPurify.sanitize(text))

  function handleRichTextChange(html: string) {
    editContent = html
    // Strip outer tags to store plain-ish text
    onchange?.({ ...data, text: html })
  }
</script>

<div class="heading-wrapper heading-{level}">
  {#if editable && editorActive}
    <RichTextEditor
      content={editContent}
      {editable}
      placeholder="Heading..."
      onchange={handleRichTextChange}
      {oneditorready}
      {oneditorblur}
      initialClickCoords={clickCoords}
    />
  {:else}
    {#if editable}
      <button
        type="button"
        class="heading-preview editable heading heading-{level}"
        onclick={(e) => { clickCoords = { x: e.clientX, y: e.clientY }; editContent = sanitizedText || text; editorActive = true }}
      >
        {@html sanitizedText || text}
      </button>
    {:else}
      <svelte:element this={headingTag} class="heading heading-{level}">{@html sanitizedText}</svelte:element>
    {/if}
  {/if}
</div>

<style>
  .heading-wrapper {
    width: 100%;
  }
  .heading, .heading-preview {
    font-family: var(--font-display);
    line-height: 1.2;
    margin: 0;
    outline: none;
  }
  .heading-preview.editable {
    cursor: text;
    border-radius: var(--radius-sm, 4px);
    padding-inline: 12px;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    width: 100%;
    display: block;
  }
  /* Pass heading typography into TipTap editor content */
  .heading-wrapper :global(.tiptap-mount) {
    padding-inline: 12px;
  }
  .heading-wrapper :global(.tiptap),
  .heading-wrapper :global(.tiptap p) {
    font-family: var(--font-display);
    line-height: 1.2;
    margin: 0;
  }

  /* ── Level-specific sizes ── */
  .heading-wrapper.heading-1, .heading-wrapper.heading-1 :global(.tiptap), .heading-wrapper.heading-1 :global(.tiptap p) {
    font-size: clamp(2rem, 5cqi, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .heading-wrapper.heading-2, .heading-wrapper.heading-2 :global(.tiptap), .heading-wrapper.heading-2 :global(.tiptap p) {
    font-size: clamp(1.5rem, 3.5cqi, 2.5rem);
    font-weight: 700;
  }
  .heading-wrapper.heading-3, .heading-wrapper.heading-3 :global(.tiptap), .heading-wrapper.heading-3 :global(.tiptap p) {
    font-size: clamp(1.1rem, 2.5cqi, 1.75rem);
    font-weight: 600;
  }
  .heading-wrapper.heading-4, .heading-wrapper.heading-4 :global(.tiptap), .heading-wrapper.heading-4 :global(.tiptap p) {
    font-size: clamp(0.95rem, 2cqi, 1.25rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
