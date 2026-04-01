<script lang="ts">
  import { untrack } from 'svelte'
  import ChatPanel from '$lib/components/chat/ChatPanel.svelte'
  import SlideOutline from '$lib/components/outline/SlideOutline.svelte'
  import SlideCanvas from '$lib/components/canvas/SlideCanvas.svelte'
  import ResourcePanel from '$lib/components/resources/ResourcePanel.svelte'
  import { base } from '$app/paths'

  let { editable = true }: { editable?: boolean } = $props()

  let leftWidth = $state(280)
  let rightWidth = $state(260)
  let leftCollapsed = $state(false)
  let rightCollapsed = $state(false)
  let chatCollapsed = $state(false)
  let outlineCollapsed = $state(false)

  function collapseChat() {
    if (!outlineCollapsed) chatCollapsed = true
  }
  function collapseOutline() {
    if (!chatCollapsed) outlineCollapsed = true
  }
  let draggingLeft = $state(false)
  let draggingRight = $state(false)

  // Canvas mode — bound to SlideCanvas
  let canvasMode = $state<'edit' | 'view'>('edit')

  // Saved panel state for view/edit toggle
  let savedLeft = false
  let savedRight = false
  let savedChat = false
  let savedOutline = false

  // Only react to canvasMode changes, not panel state
  $effect(() => {
    const mode = canvasMode
    untrack(() => {
      if (mode === 'view') {
        savedLeft = leftCollapsed
        savedRight = rightCollapsed
        savedChat = chatCollapsed
        savedOutline = outlineCollapsed
        leftCollapsed = true
        rightCollapsed = true
      } else {
        leftCollapsed = savedLeft
        rightCollapsed = savedRight
        chatCollapsed = savedChat
        outlineCollapsed = savedOutline
      }
    })
  })

  const MIN_PANEL = 200
  const MAX_PANEL = 500

  function startLeftResize(e: MouseEvent) {
    e.preventDefault()
    draggingLeft = true
    const startX = e.clientX
    const startW = leftWidth

    function onMove(e: MouseEvent) {
      const newW = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startW + (e.clientX - startX)))
      leftWidth = newW
    }
    function onUp() {
      draggingLeft = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startRightResize(e: MouseEvent) {
    e.preventDefault()
    draggingRight = true
    const startX = e.clientX
    const startW = rightWidth

    function onMove(e: MouseEvent) {
      const newW = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startW - (e.clientX - startX)))
      rightWidth = newW
    }
    function onUp() {
      draggingRight = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Ensure slides (center) remain visible on narrow viewports
  // Auto-collapse side panels below a breakpoint and restore above
  const NARROW_BP = 1024
  function handleResize() {
    const narrow = window.innerWidth < NARROW_BP
    if (narrow) {
      leftCollapsed = true
      rightCollapsed = true
    } else {
      // restore previously saved states when exiting narrow mode
      leftCollapsed = savedLeft
      rightCollapsed = savedRight
    }
  }

  $effect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })


</script>

{#snippet collapseIcon()}
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
{/snippet}

{#snippet expandIcon()}
  {@render expandIcon()}
{/snippet}

<div class="editor-wrapper">
<div class="editor-shell" class:resizing={draggingLeft || draggingRight}>
  
  {#if !leftCollapsed}
    <div class="left-panel" style:width="{leftWidth}px" style:min-width="{leftWidth}px">
      {#if !chatCollapsed && !outlineCollapsed}
        <div class="chat-section">
          <div class="section-header">
            <span class="section-label">Chat</span>
            <button class="section-toggle" onclick={collapseChat} title="Collapse chat" aria-label="Collapse chat">
              {@render collapseIcon()}
            </button>
          </div>
          <ChatPanel />
        </div>
        <div class="outline-section">
          <div class="section-header">
            <span class="section-label">Slides</span>
            <button class="section-toggle" onclick={collapseOutline} title="Collapse outline" aria-label="Collapse outline">
              {@render collapseIcon()}
            </button>
          </div>
          <SlideOutline />
        </div>
      {:else if chatCollapsed}
        <div class="collapsed-tab top">
          <button class="tab-restore" onclick={() => chatCollapsed = false} title="Expand chat" aria-label="Expand chat">
            {@render expandIcon()}
            <span>Chat</span>
          </button>
        </div>
        <div class="outline-section full">
          <div class="section-header">
            <span class="section-label">Slides</span>
            <button class="section-toggle" onclick={collapseOutline} title="Collapse outline" aria-label="Collapse outline">
              {@render collapseIcon()}
            </button>
          </div>
          <SlideOutline />
        </div>
      {:else if outlineCollapsed}
        <div class="chat-section full">
          <div class="section-header">
            <span class="section-label">Chat</span>
            <button class="section-toggle" onclick={collapseChat} title="Collapse chat" aria-label="Collapse chat">
              {@render collapseIcon()}
            </button>
          </div>
          <ChatPanel />
        </div>
        <div class="collapsed-tab bottom">
          <button class="tab-restore" onclick={() => outlineCollapsed = false} title="Expand outline" aria-label="Expand outline">
            {@render expandIcon()}
            <span>Slides</span>
          </button>
        </div>
      {/if}
    </div>
    <div class="resize-handle left-handle" onmousedown={startLeftResize}>
      <div class="handle-line"></div>
    </div>
  {/if}

  <button class="collapse-btn left-collapse" onclick={() => { if (canvasMode === 'view') { canvasMode = 'edit' } else { leftCollapsed = !leftCollapsed } }} title={leftCollapsed ? 'Show panels & edit' : 'Hide left panel'}>
    {leftCollapsed ? '▶' : '◀'}
  </button>

  <div class="center-panel">
    <SlideCanvas {editable} bind:canvasMode />
  </div>

  <button class="collapse-btn right-collapse" onclick={() => { if (canvasMode === 'view') { canvasMode = 'edit' } else { rightCollapsed = !rightCollapsed } }} title={rightCollapsed ? 'Show panels & edit' : 'Hide right panel'}>
    {rightCollapsed ? '◀' : '▶'}
  </button>

  {#if !rightCollapsed}
    <div class="resize-handle right-handle" onmousedown={startRightResize}>
      <div class="handle-line"></div>
    </div>
    <div class="right-panel" style:width="{rightWidth}px" style:min-width="{rightWidth}px">
      <ResourcePanel />
    </div>
  {/if}
</div>
<footer class="app-footer">
  <div class="footer-divider"></div>
  <div class="footer-content">
    <div class="footer-left">
      <img src="{base}/cuny-ai-lab-logo.png" alt="CUNY AI Lab" class="footer-logo" />
      <a href="https://tools.ailab.gc.cuny.edu" target="_blank" rel="noopener" class="footer-link">tools.ailab.gc.cuny.edu</a>
    </div>
    <a href="https://ailab.gc.cuny.edu" target="_blank" rel="noopener" class="footer-link-main">ailab.gc.cuny.edu</a>
  </div>
</footer>
</div>

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .editor-shell {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* Removed legacy floating toolbar */

  .editor-shell.resizing {
    cursor: col-resize;
    user-select: none;
  }

  .left-panel {
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }

  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    transition: color 0.15s, background 0.15s;
  }

  .section-toggle:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .chat-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chat-section.full {
    flex: 1;
    height: 0;
  }

  .outline-section {
    height: 260px;
    min-height: 200px;
    overflow-y: auto;
    border-top: 1px solid var(--color-border);
  }

  .outline-section.full {
    flex: 1;
    height: 0;
    min-height: 0;
    border-top: none;
    overflow-y: hidden;
  }

  .collapsed-tab {
    flex-shrink: 0;
  }

  .collapsed-tab.top {
    border-bottom: 1px solid var(--color-border);
  }

  .collapsed-tab.bottom {
    border-top: 1px solid var(--color-border);
  }

  .tab-restore {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .tab-restore:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .center-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-tertiary);
    min-width: 0;
  }

  .right-panel {
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    overflow: hidden;
  }

  /* Resize handles */
  .resize-handle {
    width: 6px;
    cursor: col-resize;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 10;
    transition: background 0.15s;
  }

  .resize-handle:hover, .resize-handle:active {
    background: rgba(59, 115, 230, 0.1);
  }

  .handle-line {
    width: 2px;
    height: 32px;
    background: var(--color-border);
    border-radius: 2px;
    transition: background 0.15s;
  }

  .resize-handle:hover .handle-line, .resize-handle:active .handle-line {
    background: var(--color-primary);
  }

  /* Collapse buttons */
  .collapse-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 52px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .collapse-btn:hover {
    background: var(--color-primary-dark, #1D3A83);
    color: white;
    border-color: var(--color-primary-dark, #1D3A83);
    box-shadow: 0 2px 8px rgba(29, 58, 131, 0.25);
  }

  .collapse-btn:active {
    background: var(--color-primary, #3B73E6);
    border-color: var(--color-primary, #3B73E6);
    box-shadow: none;
  }

  .left-collapse {
    left: 0;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    border-left: none;
  }

  .right-collapse {
    right: 0;
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    border-right: none;
  }

  /* App footer */
  .app-footer {
    flex-shrink: 0;
    padding: 0 28px 12px;
    background: var(--color-bg);
  }

  .footer-divider {
    height: 1px;
    background: var(--color-border, #e5e7eb);
    opacity: 0.3;
    margin-bottom: 10px;
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .footer-logo {
    width: 36px;
    height: 36px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .footer-link {
    font-size: 13px;
    color: var(--color-text-muted, #9ca3af);
    text-decoration: none;
    transition: color 0.15s;
  }

  .footer-link:hover {
    color: var(--color-primary, #3B73E6);
  }

  .footer-link-main {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-decoration: none;
    letter-spacing: 0.02em;
    transition: color 0.15s;
  }

  .footer-link-main:hover {
    color: var(--color-primary, #3B73E6);
  }

  /* Smooth section transitions */
  .chat-section, .outline-section, .collapsed-tab {
    transition: flex 0.2s ease, height 0.2s ease;
  }

  /* Responsive: auto-collapse panels on narrow viewports */
  @media (max-width: 1024px) {
    .left-panel {
      max-width: 240px;
    }
    .right-panel {
      max-width: 220px;
    }
    .outline-section:not(.full) {
      height: 200px;
      min-height: 160px;
    }
  }

  @media (max-width: 860px) {
    .left-panel {
      max-width: 200px;
    }
    .right-panel {
      max-width: 180px;
    }
  }
</style>
