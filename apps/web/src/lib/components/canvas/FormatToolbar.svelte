<script lang="ts">
  import type { Editor } from '@tiptap/core'

  let { editor }: { editor: Editor | null } = $props()

  let isBold = $state(false)
  let isItalic = $state(false)
  let isLink = $state(false)
  let isBulletList = $state(false)
  let isOrderedList = $state(false)

  function update() {
    if (!editor) return
    isBold = editor.isActive('bold')
    isItalic = editor.isActive('italic')
    isLink = editor.isActive('link')
    isBulletList = editor.isActive('bulletList')
    isOrderedList = editor.isActive('orderedList')
  }

  $effect(() => {
    if (!editor) return
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    update()
    return () => {
      editor?.off('selectionUpdate', update)
      editor?.off('transaction', update)
    }
  })

  function cmd(fn: () => void) {
    return (e: MouseEvent) => { e.preventDefault(); fn() }
  }
</script>

{#if editor}
  <div class="format-toolbar">
    <button class="fmt-btn" class:active={isBold} onmousedown={cmd(() => editor?.chain().focus().toggleBold().run())} title="Bold (Ctrl+B)"><strong>B</strong></button>
    <button class="fmt-btn" class:active={isItalic} onmousedown={cmd(() => editor?.chain().focus().toggleItalic().run())} title="Italic (Ctrl+I)"><em>I</em></button>
    <div class="sep"></div>
    <button class="fmt-btn" class:active={isLink} onmousedown={cmd(() => {
      if (editor?.isActive('link')) { editor?.chain().focus().unsetLink().run() }
      else { const url = prompt('URL:'); if (url) editor?.chain().focus().setLink({ href: url }).run() }
    })} title="Link">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>
    <div class="sep"></div>
    <button class="fmt-btn" class:active={isBulletList} onmousedown={cmd(() => editor?.chain().focus().toggleBulletList().run())} title="Bullet List">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="4" cy="18" r="2"/><rect x="9" y="5" width="12" height="2" rx="1"/><rect x="9" y="11" width="12" height="2" rx="1"/><rect x="9" y="17" width="12" height="2" rx="1"/></svg>
    </button>
    <button class="fmt-btn" class:active={isOrderedList} onmousedown={cmd(() => editor?.chain().focus().toggleOrderedList().run())} title="Numbered List">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><text x="1" y="8" font-size="7" font-weight="bold" font-family="sans-serif">1</text><text x="1" y="15" font-size="7" font-weight="bold" font-family="sans-serif">2</text><text x="1" y="21" font-size="7" font-weight="bold" font-family="sans-serif">3</text><rect x="9" y="5" width="12" height="2" rx="1"/><rect x="9" y="11" width="12" height="2" rx="1"/><rect x="9" y="17" width="12" height="2" rx="1"/></svg>
    </button>
  </div>
{:else}
  <div class="format-toolbar disabled">
    <span class="hint">Double-click a text block to edit</span>
  </div>
{/if}

<style>
  .format-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .format-toolbar.disabled {
    justify-content: center;
  }

  .hint {
    font-size: 11px;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .fmt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    padding: 0;
  }

  .fmt-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .fmt-btn.active {
    background: var(--color-primary);
    color: white;
  }

  .sep {
    width: 1px;
    height: 18px;
    background: var(--color-border);
    margin: 0 4px;
  }
</style>
