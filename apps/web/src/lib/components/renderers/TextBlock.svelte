<script lang="ts">
  import { fitText } from '$lib/utils/text-measure'
  import RichTextEditor from './RichTextEditor.svelte'

  import type { Editor } from '@tiptap/core'
  let { data = {}, editable = false, onchange, oneditorready }: { data: Record<string, unknown>; editable: boolean; onchange?: (newData: Record<string, unknown>) => void; oneditorready?: (editor: Editor) => void } = $props()

  let text = $derived(typeof data.markdown === 'string' ? data.markdown : typeof data.text === 'string' ? data.text : '')
  let column = $derived(typeof data.column === 'string' ? data.column : '')

  let containerEl: HTMLDivElement | undefined = $state(undefined)
  let fittedFontSize: number | undefined = $state(undefined)

  const BASE_SIZE = 17 // ~1.1rem
  const MIN_SIZE = 12
  const LINE_HEIGHT = 1.7

  $effect(() => {
    // Track text so we re-measure when it changes
    void text
    if (!containerEl || !text.trim()) {
      fittedFontSize = undefined
      return
    }
    const w = containerEl.clientWidth
    const h = containerEl.clientHeight
    if (w <= 0 || h <= 0) {
      fittedFontSize = undefined
      return
    }
    const size = fitText(text, 'Inter', BASE_SIZE, '400', w, h, LINE_HEIGHT, MIN_SIZE)
    fittedFontSize = size < BASE_SIZE ? size : undefined
  })

  function markdownToHtml(md: string): string {
    const lines = md.split('\n')
    const out: string[] = []
    let inList = false
    let listType = ''

    for (const line of lines) {
      const bulletMatch = line.match(/^[-*]\s+(.+)/)
      const numberedMatch = line.match(/^\d+\.\s+(.+)/)

      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
          out.push('<ul>')
          inList = true
          listType = 'ul'
        }
        out.push(`<li>${inlineMarkdown(bulletMatch[1])}</li>`)
      } else if (numberedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')
          out.push('<ol>')
          inList = true
          listType = 'ol'
        }
        out.push(`<li>${inlineMarkdown(numberedMatch[1])}</li>`)
      } else {
        if (inList) {
          out.push(listType === 'ol' ? '</ol>' : '</ul>')
          inList = false
          listType = ''
        }
        if (line.trim() === '') {
          out.push('<br>')
        } else {
          out.push(`<p>${inlineMarkdown(line)}</p>`)
        }
      }
    }
    if (inList) out.push(listType === 'ol' ? '</ol>' : '</ul>')

    return out.join('\n')
  }

  function inlineMarkdown(text: string): string {
    let html = text
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    return html
  }

  // Use stored HTML if available (from TipTap edits), otherwise convert markdown
  let renderedHtml = $derived(
    typeof data.html === 'string' ? data.html : markdownToHtml(text)
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
  {#if editable}
    <RichTextEditor
      content={renderedHtml}
      {editable}
      placeholder="Type text here..."
      onchange={handleRichTextChange}
      {oneditorready}
    />
  {:else}
    {@html renderedHtml}
  {/if}
</div>

<style>
  .text-block {
    font-family: var(--font-body);
    font-size: clamp(0.85rem, 1.5vw, 1.1rem);
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
</style>
