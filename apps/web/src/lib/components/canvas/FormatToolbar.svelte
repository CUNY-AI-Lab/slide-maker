<script lang="ts">
  import type { Editor } from '@tiptap/core'
  import { get } from 'svelte/store'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId, activeModuleControls } from '$lib/stores/ui'
  import { applyMutation } from '$lib/utils/mutations'

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

  async function setAlignment(dir: 'left' | 'center' | 'right') {
    if (editor) {
      const el = editor.view.dom
      if (el) el.style.textAlign = dir
      return
    }
    // No active text editor: if a module popover is open, apply alignment to that block
    const modId = get(activeModuleControls)
    const slideId = get(activeSlideId)
    const deck = get(currentDeck)
    if (!modId || !slideId || !deck) return
    const slide = deck.slides.find((s) => s.id === slideId)
    const block = slide?.blocks.find((b) => b.id === modId)
    if (!block) return
    if (block.type === 'artifact' || block.type === 'image') {
      await applyMutation({ action: 'updateBlock', payload: { slideId, blockId: block.id, data: { align: dir } } })
    }
  }

  function cmd(fn: () => void) {
    return (e: MouseEvent) => { e.preventDefault(); fn() }
  }
</script>

{#if editor}
  <div class="format-toolbar">
    <select class="heading-select" onchange={(e) => {
      const val = (e.target as HTMLSelectElement).value
      if (val === 'p') { editor?.chain().focus().setParagraph().run() }
      else { editor?.chain().focus().toggleHeading({ level: Number(val) as 1|2|3|4 }).run() }
    }} title="Text Style">
      <option value="p">Normal</option>
      <option value="1">H1</option>
      <option value="2">H2</option>
      <option value="3">H3</option>
      <option value="4">H4</option>
    </select>
    <select class="font-size-select" onchange={(e) => {
      const size = (e.target as HTMLSelectElement).value
      if (size === 'default') {
        editor?.chain().focus().run()
        const el = editor?.view.dom
        if (el) el.style.fontSize = ''
      } else {
        editor?.chain().focus().run()
        const el = editor?.view.dom
        if (el) el.style.fontSize = size
      }
    }} title="Font Size">
      <option value="default">Size</option>
      <option value="12px">12</option>
      <option value="14px">14</option>
      <option value="16px">16</option>
      <option value="18px">18</option>
      <option value="20px">20</option>
      <option value="24px">24</option>
      <option value="28px">28</option>
      <option value="32px">32</option>
    </select>
    <div class="sep"></div>
    <button class="fmt-btn" class:active={isBold} onmousedown={cmd(() => editor?.chain().focus().toggleBold().run())} title="Bold (Ctrl+B)"><strong>B</strong></button>
    <button class="fmt-btn" class:active={isItalic} onmousedown={cmd(() => editor?.chain().focus().toggleItalic().run())} title="Italic (Ctrl+I)"><em>I</em></button>
    <div class="sep"></div>
    <button class="fmt-btn" class:active={isLink} onmousedown={cmd(() => {
      if (editor?.isActive('link')) { editor?.chain().focus().unsetLink().run() }
      else { const url = prompt('URL:'); if (url && /^https?:\/\//i.test(url)) editor?.chain().focus().setLink({ href: url }).run() }
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
    <div class="sep"></div>
    <button class="fmt-btn" onmousedown={cmd(() => setAlignment('left'))} title="Align Left">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="2" rx="1"/><rect x="3" y="9" width="12" height="2" rx="1"/><rect x="3" y="14" width="16" height="2" rx="1"/><rect x="3" y="19" width="10" height="2" rx="1"/></svg>
    </button>
    <button class="fmt-btn" onmousedown={cmd(() => setAlignment('center'))} title="Align Center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="2" rx="1"/><rect x="6" y="9" width="12" height="2" rx="1"/><rect x="4" y="14" width="16" height="2" rx="1"/><rect x="7" y="19" width="10" height="2" rx="1"/></svg>
    </button>
    <button class="fmt-btn" onmousedown={cmd(() => setAlignment('right'))} title="Align Right">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="2" rx="1"/><rect x="9" y="9" width="12" height="2" rx="1"/><rect x="5" y="14" width="16" height="2" rx="1"/><rect x="11" y="19" width="10" height="2" rx="1"/></svg>
    </button>
  </div>
{:else}
  <div class="format-toolbar disabled">
    <span class="hint">Click a text block to edit</span>
  </div>
{/if}

<style>
  .format-toolbar {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 2px 6px;
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
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12px;
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

  .heading-select {
    height: 26px;
    padding: 0 3px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-secondary);
    font-size: 11px;
    font-family: var(--font-body);
    cursor: pointer;
    outline: none;
    font-weight: 600;
  }

  .heading-select:hover {
    border-color: var(--color-primary);
  }

  .font-size-select {
    height: 26px;
    padding: 0 3px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-secondary);
    font-size: 11px;
    font-family: var(--font-body);
    cursor: pointer;
    outline: none;
  }

  .font-size-select:hover {
    border-color: var(--color-primary);
  }
</style>
