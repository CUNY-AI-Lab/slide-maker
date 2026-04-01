<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Link from '@tiptap/extension-link'
  import Placeholder from '@tiptap/extension-placeholder'

  let {
    content = '',
    editable = false,
    placeholder = 'Type here...',
    onchange,
    oneditorready,
    class: className = '',
  }: {
    content: string
    editable: boolean
    placeholder?: string
    onchange?: (html: string) => void
    oneditorready?: (editor: Editor) => void
    class?: string
  } = $props()

  let editorEl: HTMLDivElement | undefined = $state(undefined)
  let toolbarEl: HTMLDivElement | undefined = $state(undefined)
  let editor: Editor | null = $state(null)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let lastEmittedHtml = $state('')
  // Toolbar state tracking

  // Toolbar active states
  let isBold = $state(false)
  let isItalic = $state(false)
  let isLink = $state(false)
  let isBulletList = $state(false)
  let isOrderedList = $state(false)

  function updateToolbarState() {
    if (!editor) return
    isBold = editor.isActive('bold')
    isItalic = editor.isActive('italic')
    isLink = editor.isActive('link')
    isBulletList = editor.isActive('bulletList')
    isOrderedList = editor.isActive('orderedList')
  }

  function positionToolbar() {
    updateToolbarState()
  }

  onMount(() => {
    if (!editorEl) return

    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ link: false }),
        Link.configure({
          openOnClick: false,
          protocols: ['http', 'https', 'mailto'],
          validate: (href: string) => /^https?:\/\/|^mailto:/i.test(href),
        }),
        Placeholder.configure({ placeholder }),
      ],
      content,
      editable,
      onUpdate: ({ editor: ed }) => {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          const html = ed.getHTML()
          lastEmittedHtml = html
          onchange?.(html)
        }, 500)
      },
      onSelectionUpdate: () => {
        positionToolbar()
      },
      onBlur: () => {
        updateToolbarState()
      },
    })

    oneditorready?.(editor)
  })

  onDestroy(() => {
    clearTimeout(saveTimer)
    if (editor) {
      editor.destroy()
      editor = null
    }
  })

  // Update editable state when prop changes
  $effect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  })

  // Guard against external content changes (e.g., undo/redo, AI mutations)
  $effect(() => {
    if (editor && content !== lastEmittedHtml && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  })

  function withPreventDefault(fn: () => void) {
    return (e: MouseEvent) => {
      e.preventDefault()
      fn()
    }
  }

  function toggleBold() {
    editor?.chain().focus().toggleBold().run()
    updateToolbarState()
  }

  function toggleItalic() {
    editor?.chain().focus().toggleItalic().run()
    updateToolbarState()
  }

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = prompt('Enter URL:')
      if (url && /^https?:\/\//i.test(url)) {
        editor.chain().focus().setLink({ href: url }).run()
      }
    }
    updateToolbarState()
  }

  function toggleBulletList() {
    editor?.chain().focus().toggleBulletList().run()
    updateToolbarState()
  }

  function toggleOrderedList() {
    editor?.chain().focus().toggleOrderedList().run()
    updateToolbarState()
  }
</script>

<div class="rich-text-editor {className}">
  <div bind:this={editorEl} class="tiptap-mount"></div>
</div>

<style>
  .rich-text-editor {
    width: 100%;
    min-height: 1em;
  }

  .tiptap-mount {
    width: 100%;
    outline: none;
  }

  /* TipTap editor element styles */
  .tiptap-mount :global(.tiptap) {
    outline: none;
    min-height: 1em;
  }

  .tiptap-mount :global(.tiptap p) {
    margin: 0.5em 0;
  }

  .tiptap-mount :global(.tiptap p:first-child) {
    margin-top: 0;
  }

  .tiptap-mount :global(.tiptap p:last-child) {
    margin-bottom: 0;
  }

  .tiptap-mount :global(.tiptap ul),
  .tiptap-mount :global(.tiptap ol) {
    padding-left: 1.5em;
    margin: 0.4em 0;
  }

  .tiptap-mount :global(.tiptap li) {
    margin-bottom: 0.5em;
  }

  .tiptap-mount :global(.tiptap a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .tiptap-mount :global(.tiptap strong) {
    font-weight: 600;
  }

  .tiptap-mount :global(.tiptap code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.88em;
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  }

  .tiptap-mount :global(.tiptap blockquote) {
    border-left: 3px solid var(--color-primary, #3b82f6);
    padding-left: 1em;
    margin: 0.5em 0;
    color: var(--color-text-muted, #666);
  }

  /* Placeholder style */
  .tiptap-mount :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--color-text-muted, #aaa);
    pointer-events: none;
    height: 0;
  }

</style>
