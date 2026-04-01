<script lang="ts">
  import { fitText } from '$lib/utils/text-measure'
  import { markdownToHtml } from '$lib/utils/markdown'
  import RichTextEditor from './RichTextEditor.svelte'
  import DOMPurify from 'dompurify'

  import type { Editor } from '@tiptap/core'
  let { data = {}, editable = false, onchange, oneditorready }: { data: Record<string, unknown>; editable: boolean; onchange?: (newData: Record<string, unknown>) => void; oneditorready?: (editor: Editor) => void } = $props()

  let text = $derived(typeof data.markdown === 'string' ? data.markdown : typeof data.text === 'string' ? data.text : '')
  let column = $derived(typeof data.column === 'string' ? data.column : '')

  let containerEl: HTMLDivElement | undefined = $state(undefined)
  let fittedFontSize: number | undefined = $state(undefined)
  let editorActive = $state(false)

  const BASE_SIZE = 17
  const MIN_SIZE = 12
  const LINE_HEIGHT = 1.7

  $effect(() => {
    void text
    if (!containerEl || !text.trim()) {
      fittedFontSize = undefined
      return
    }
    // Defer fitText until after first paint so it doesn't block slide transitions
    const raf = requestAnimationFrame(() => {
      if (!containerEl) return
      const w = containerEl.clientWidth
      const h = containerEl.clientHeight
      if (w <= 0 || h <= 0) {
        fittedFontSize = undefined
        return
      }
      const size = fitText(text, 'Inter', BASE_SIZE, '400', w, h, LINE_HEIGHT, MIN_SIZE)
      fittedFontSize = size < BASE_SIZE ? size : undefined
    })
    return () => cancelAnimationFrame(raf)
  })

  let renderedHtml = $derived(
    DOMPurify.sanitize(typeof data.html === 'string' ? data.html : markdownToHtml(text))
  )

  function handleRichTextChange(html: string) {
    onchange?.({ ...data, html })
  }
</script>

<div
  bind:this={containerEl}
  class="text-block"
  class:column-left={column === 'left'}
  class:column-right={column === 'right'}
  style:font-size={fittedFontSize ? `${fittedFontSize}px` : undefined}
>
  {#if editable && editorActive}
    <RichTextEditor
      content={renderedHtml}
      {editable}
      placeholder="Type text here..."
      onchange={handleRichTextChange}
      {oneditorready}
    />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="text-preview"
      class:editable
      onclick={() => { if (editable) editorActive = true }}
      onkeydown={(e) => { if (editable && e.key === 'Enter') editorActive = true }}
      role={editable ? 'button' : undefined}
      tabindex={editable ? 0 : undefined}
    >
      {@html renderedHtml}
    </div>
  {/if}
</div>

<style>
  .text-block {
    font-family: var(--font-body);
    font-size: clamp(0.85rem, 1.5cqi, 1.1rem);
    line-height: 1.7;
    color: inherit;
    outline: none;
  }
  .text-block :global(a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .text-block :global(a:hover) {
    color: var(--blue-hover);
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
    border-radius: var(--radius-sm, 4px);
  }
  .text-preview.editable:hover {
    outline: 1px dashed rgba(59, 115, 230, 0.25);
    outline-offset: 2px;
  }
</style>
