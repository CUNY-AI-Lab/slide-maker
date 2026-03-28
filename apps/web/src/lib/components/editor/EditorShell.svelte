<script lang="ts">
  import ChatPanel from '$lib/components/chat/ChatPanel.svelte'
  import SlideOutline from '$lib/components/outline/SlideOutline.svelte'
  import SlideCanvas from '$lib/components/canvas/SlideCanvas.svelte'
  import ResourcePanel from '$lib/components/resources/ResourcePanel.svelte'

  let { editable = true }: { editable?: boolean } = $props()

  let leftWidth = $state(280)
  let rightWidth = $state(260)
  let leftCollapsed = $state(false)
  let rightCollapsed = $state(false)
  let draggingLeft = $state(false)
  let draggingRight = $state(false)

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
</script>

<div class="editor-shell" class:resizing={draggingLeft || draggingRight}>
  {#if !leftCollapsed}
    <div class="left-panel" style:width="{leftWidth}px" style:min-width="{leftWidth}px">
      <div class="chat-section">
        <ChatPanel />
      </div>
      <div class="outline-section">
        <SlideOutline />
      </div>
    </div>
    <div class="resize-handle left-handle" onmousedown={startLeftResize}>
      <div class="handle-line"></div>
    </div>
  {/if}

  <button class="collapse-btn left-collapse" onclick={() => leftCollapsed = !leftCollapsed} title={leftCollapsed ? 'Show left panel' : 'Hide left panel'}>
    {leftCollapsed ? '▶' : '◀'}
  </button>

  <div class="center-panel">
    <SlideCanvas {editable} />
  </div>

  <button class="collapse-btn right-collapse" onclick={() => rightCollapsed = !rightCollapsed} title={rightCollapsed ? 'Show right panel' : 'Hide right panel'}>
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

<style>
  .editor-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

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

  .chat-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-bottom: 2px solid var(--color-border);
    min-height: 0;
  }

  .outline-section {
    height: 260px;
    min-height: 200px;
    overflow-y: auto;
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
    width: 20px;
    height: 48px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    transition: background 0.15s, color 0.15s;
    padding: 0;
  }

  .collapse-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-primary);
  }

  .left-collapse {
    left: 0;
    border-radius: 0 4px 4px 0;
    border-left: none;
  }

  .right-collapse {
    right: 0;
    border-radius: 4px 0 0 4px;
    border-right: none;
  }
</style>
