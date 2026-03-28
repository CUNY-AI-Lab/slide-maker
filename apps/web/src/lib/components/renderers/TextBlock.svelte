<script lang="ts">
  let { data = {}, editable = false }: { data: Record<string, unknown>; editable: boolean } = $props()

  let text = $derived(typeof data.markdown === 'string' ? data.markdown : typeof data.text === 'string' ? data.text : '')
  let column = $derived(typeof data.column === 'string' ? data.column : '')

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

  let renderedHtml = $derived(markdownToHtml(text))

  function handleInput(e: Event) {
    const target = e.target as HTMLElement
    data.text = target.innerText ?? ''
  }
</script>

<div
  class="text-block"
  class:column-left={column === 'left'}
  class:column-right={column === 'right'}
  contenteditable={editable}
  oninput={handleInput}
  role={editable ? 'textbox' : undefined}
>
  {#if editable}
    {text}
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
  .text-block[contenteditable="true"]:focus {
    outline: 1px dashed var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
</style>
