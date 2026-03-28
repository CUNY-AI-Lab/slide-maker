<script lang="ts">
  let { data = {}, editable = false }: { data: Record<string, unknown>; editable: boolean } = $props()

  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let column = $derived(typeof data.column === 'string' ? data.column : '')

  function markdownToHtml(md: string): string {
    let html = md
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Newlines
    html = html.replace(/\n/g, '<br>')
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
    font-size: 0.95rem;
    line-height: 1.6;
    color: inherit;
    outline: none;
  }
  .text-block :global(a) {
    color: var(--color-primary);
    text-decoration: underline;
  }
  .text-block :global(strong) {
    font-weight: 600;
  }
  .column-left { text-align: left; }
  .column-right { text-align: right; }
  .text-block[contenteditable="true"]:focus {
    outline: 1px dashed var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
</style>
