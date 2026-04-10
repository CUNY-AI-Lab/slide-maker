<script lang="ts">
  import { chatStreaming, chatDraft } from '$lib/stores/chat'
  import { currentDeck } from '$lib/stores/deck'
  import { api } from '$lib/api'
  import { API_URL } from '$lib/api'
  import { get } from 'svelte/store'
  import { activeSlideId } from '$lib/stores/ui'
  import { artifactsStore, ensureArtifactsLoaded } from '$lib/stores/artifacts'
  import ChatRichTextEditor from './ChatRichTextEditor.svelte'
  import ChatFormattingToolbar from './ChatFormattingToolbar.svelte'
  import type { Editor } from '@tiptap/core'

  interface Props {
    onsend: (text: string) => void
  }

  let { onsend }: Props = $props()
  let dragOver = $state(false)
  let uploading = $state(false)
  let editorFocused = $state(false)
  let blurTimer: ReturnType<typeof setTimeout> | undefined

  let richEditor: ChatRichTextEditor | undefined = $state()
  let editor: Editor | null = $state(null)

  // Track plain text for derived checks (mention detection, /add, canSend)
  let plainText = $state('')

  // Inject drafts from resources panel
  $effect(() => {
    const draft = $chatDraft
    if (!draft) return
    richEditor?.insertContent(draft)
    chatDraft.set('')
    richEditor?.focus()
  })

  let showAddMenu = $derived(plainText.trim() === '/add')
  let hasSlides = $derived(!!$currentDeck && ($currentDeck.slides?.length ?? 0) > 0)
  let placeholderText = $derived.by(() => {
    if (!hasSlides) return 'Describe your first slide — AI will create it'
    return $activeSlideId ? 'Describe changes to this slide…' : 'Select a slide to enable edits (or type /search)'
  })
  let canSend = $derived.by(() => {
    const trimmed = plainText.trim()
    if (!trimmed || $chatStreaming || uploading) return false
    if (trimmed.startsWith('/search ')) return true
    return !hasSlides || !!$activeSlideId
  })

  // ── @ mention autocomplete ──────────────────────────────────────────────────

  interface MentionItem { name: string; prefix: 'artifact' | 'template' }

  let mentionQuery = $state<string | null>(null)  // null = closed
  let mentionAtPos = $state(-1) // ProseMirror position of the @
  let mentionIndex = $state(0)
  let mentionDataLoaded = $state(false)
  let mentionTemplates = $state<MentionItem[]>([])

  async function loadMentionData() {
    if (mentionDataLoaded) return
    mentionDataLoaded = true
    await ensureArtifactsLoaded()
    try {
      const res = await fetch(`${API_URL}/api/templates`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        mentionTemplates = (data.templates ?? []).map((t: any) => ({ name: t.name, prefix: 'template' as const }))
      }
    } catch { /* non-fatal */ }
  }

  let mentionItems = $derived.by((): MentionItem[] => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const artifacts = ($artifactsStore ?? []).map((a) => ({ name: a.name, prefix: 'artifact' as const }))
    const all: MentionItem[] = [...artifacts, ...mentionTemplates]
    return q ? all.filter((m) => m.name.toLowerCase().includes(q)) : all
  })

  function detectMention() {
    if (!richEditor) return
    const { textBefore, pos } = richEditor.getSelectionText()
    const match = textBefore.match(/@([\w ]*)$/)
    if (match) {
      mentionQuery = match[1]
      // Calculate ProseMirror position of the @ character
      mentionAtPos = pos - match[0].length
      mentionIndex = 0
      if (!mentionDataLoaded) loadMentionData()
    } else {
      mentionQuery = null
      mentionAtPos = -1
    }
  }

  function selectMention(item: MentionItem) {
    if (!richEditor) return
    const { pos } = richEditor.getSelectionText()
    const token = `@${item.prefix}:${item.name}`
    // Replace from @ position to current cursor with the full token
    richEditor.deleteRangeAndInsert(mentionAtPos, pos, token)
    mentionQuery = null
    mentionAtPos = -1
    // Update plainText after insertion
    requestAnimationFrame(() => {
      plainText = richEditor?.getText() ?? ''
    })
  }

  function closeMention() {
    mentionQuery = null
    mentionAtPos = -1
  }

  function isMentionOpen(): boolean {
    return mentionQuery !== null && mentionItems.length > 0
  }

  // ── Mention chips (parsed from text) ───────────────────────────────────────

  let activeMentions = $derived.by(() => {
    const matches = [...plainText.matchAll(/@(artifact|template):([^\n@]+)/g)]
    return matches.map((m) => ({ prefix: m[1] as 'artifact' | 'template', name: m[2].trim(), full: m[0] }))
  })

  function removeMention(full: string) {
    if (!richEditor) return
    const editorInstance = richEditor.getEditor()
    if (!editorInstance) return
    const docText = editorInstance.getText()
    const idx = docText.indexOf(full)
    if (idx < 0) return
    // Map text offset to ProseMirror position (add 1 for doc start offset)
    // Walk the doc to find precise position
    let pmFrom = 0
    let charCount = 0
    editorInstance.state.doc.descendants((node, pos) => {
      if (pmFrom > 0) return false
      if (node.isText) {
        const nodeText = node.text ?? ''
        const offsetInNode = idx - charCount
        if (offsetInNode >= 0 && offsetInNode < nodeText.length) {
          pmFrom = pos + offsetInNode
          return false
        }
        charCount += nodeText.length
      } else if (node.type.name === 'hardBreak') {
        charCount += 1
      }
    })
    if (pmFrom > 0) {
      editorInstance.chain().focus().deleteRange({ from: pmFrom, to: pmFrom + full.length }).run()
      requestAnimationFrame(() => {
        plainText = richEditor?.getText() ?? ''
      })
    }
  }

  // ── Module shortcuts (/add menu) ────────────────────────────────────────────

  const moduleShortcuts = [
    { type: 'heading', label: 'Heading' },
    { type: 'text', label: 'Text Block' },
    { type: 'card', label: 'Info Card' },
    { type: 'label', label: 'Section Label' },
    { type: 'tip-box', label: 'Callout Box' },
    { type: 'prompt-block', label: 'Code Block' },
    { type: 'image', label: 'Image' },
    { type: 'carousel', label: 'Image Carousel' },
    { type: 'comparison', label: 'Comparison' },
    { type: 'card-grid', label: 'Card Grid' },
    { type: 'flow', label: 'Process Flow' },
    { type: 'stream-list', label: 'Bullet List' },
  ]

  function selectModule(label: string) {
    richEditor?.clear()
    richEditor?.insertContent(`Add a ${label} to the active slide`)
    handleSubmit()
  }

  // ── Send / keyboard ─────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!richEditor) return
    const markdown = richEditor.getMarkdown()
    const trimmed = markdown.trim()
    if (!trimmed || $chatStreaming) return
    if (!trimmed.startsWith('/search ') && hasSlides && !$activeSlideId) return
    onsend(trimmed)
    richEditor.clear()
    plainText = ''
  }

  function handleEditorKeydown(e: KeyboardEvent) {
    // Autocomplete keyboard nav — runs on the wrapper div to intercept before TipTap
    if (mentionQuery !== null && mentionItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mentionIndex = (mentionIndex + 1) % mentionItems.length; return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); mentionIndex = (mentionIndex - 1 + mentionItems.length) % mentionItems.length; return }
      if (e.key === 'Enter')     { e.preventDefault(); selectMention(mentionItems[mentionIndex]); return }
      if (e.key === 'Escape')    { closeMention(); return }
    }
  }

  function handleEditorInput() {
    plainText = richEditor?.getText() ?? ''
    editor = richEditor?.getEditor() ?? null
    detectMention()
  }

  function handleFocusChange(focused: boolean) {
    clearTimeout(blurTimer)
    if (focused) {
      editorFocused = true
      editor = richEditor?.getEditor() ?? null
    } else {
      // Delay blur so toolbar button clicks register
      blurTimer = setTimeout(() => { editorFocused = false }, 150)
    }
  }

  // ── File drag-and-drop ──────────────────────────────────────────────────────

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave() {
    dragOver = false
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false

    const files = e.dataTransfer?.files
    if (!files?.length) return

    const deck = get(currentDeck)
    if (!deck) return

    uploading = true
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadFile(deck.id, file)
        if (result?.file) {
          const label = file.type.startsWith('image/') ? 'image' : 'file'
          richEditor?.insertContent(`[Uploaded ${label}: ${file.name}]`)
        }
      }
      plainText = richEditor?.getText() ?? ''
    } catch (err: any) {
      richEditor?.insertContent(`[Upload failed: ${err.message}]`)
    } finally {
      uploading = false
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="chat-input"
  class:drag-over={dragOver}
  class:editor-focused={editorFocused}
  role="region"
  aria-label="Chat input and attachments"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onkeydown={handleEditorKeydown}
>
  {#if showAddMenu}
    <div class="add-menu">
      {#each moduleShortcuts as mod}
        <button class="add-menu-item" onmousedown={() => selectModule(mod.label)}>
          {mod.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if mentionQuery !== null && mentionItems.length > 0}
    <div class="mention-popup" role="listbox">
      {#each mentionItems.slice(0, 12) as item, i}
        <button
          class="mention-item"
          class:mention-item-active={i === mentionIndex}
          role="option"
          aria-selected={i === mentionIndex}
          onmousedown={(e) => { e.preventDefault(); selectMention(item) }}
        >
          <span class="mention-prefix">{item.prefix === 'artifact' ? '⬡' : '▤'}</span>
          <span class="mention-name">{item.name}</span>
          <span class="mention-type">{item.prefix}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if dragOver}
    <div class="drop-overlay">Drop file to upload</div>
  {/if}

  {#if activeMentions.length > 0}
    <div class="mention-chips">
      {#each activeMentions as m}
        <span class="mention-chip" title="@{m.prefix}:{m.name}">
          <span class="chip-at">@</span>{m.name}
          <button class="chip-remove" onclick={() => removeMention(m.full)} aria-label="Remove mention">×</button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="editor-row">
    <ChatRichTextEditor
      bind:this={richEditor}
      placeholder={placeholderText}
      disabled={$chatStreaming || uploading}
      {isMentionOpen}
      onsubmit={handleSubmit}
      oninput={handleEditorInput}
      onfocuschange={handleFocusChange}
    />
    <button
      class="send-btn"
      onclick={handleSubmit}
      disabled={!canSend}
      title={canSend ? 'Send (Enter)' : ($activeSlideId ? 'Type a message' : 'Select a slide first (or use /search)')}
    >
      {#if $chatStreaming || uploading}
        <span class="spinner"></span>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      {/if}
    </button>
  </div>

  <ChatFormattingToolbar {editor} visible={editorFocused} />
</div>

<style>
  .chat-input {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 10px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    position: relative;
    transition: box-shadow 200ms ease-out;
  }

  .chat-input.editor-focused {
    box-shadow: 0 -2px 12px rgba(47, 184, 214, 0.06);
  }

  .chat-input.drag-over {
    border-color: var(--color-primary);
    background: rgba(59, 115, 230, 0.04);
  }

  .editor-row {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 115, 230, 0.08);
    border: 2px dashed var(--color-primary);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    z-index: 5;
    pointer-events: none;
  }

  .send-btn {
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    align-self: stretch;
    min-width: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(59, 115, 230, 0.2);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── /add menu ── */
  .add-menu {
    position: absolute;
    bottom: 100%;
    left: 10px;
    right: 10px;
    margin-bottom: 4px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 4px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    z-index: 10;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  }

  .add-menu-item {
    padding: 6px 8px;
    font-size: 12px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .add-menu-item:hover {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
  }

  /* ── @ autocomplete popup ── */
  .mention-popup {
    position: absolute;
    bottom: 100%;
    left: 10px;
    right: 10px;
    margin-bottom: 4px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 4px;
    z-index: 11;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
  }

  .mention-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    font-size: 12px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.1s;
  }

  .mention-item:hover,
  .mention-item-active {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
  }

  .mention-prefix {
    font-size: 10px;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .mention-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mention-type {
    font-size: 10px;
    opacity: 0.45;
    flex-shrink: 0;
  }

  /* ── Mention chips bar ── */
  .mention-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
    margin-bottom: 6px;
  }

  .mention-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px 2px 5px;
    font-size: 11px;
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
    border: 1px solid rgba(59, 115, 230, 0.25);
    border-radius: 999px;
    line-height: 1.4;
  }

  .chip-at {
    opacity: 0.6;
    font-size: 10px;
  }

  .chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    margin-left: 1px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    transition: opacity 0.1s;
  }

  .chip-remove:hover {
    opacity: 1;
  }
</style>
