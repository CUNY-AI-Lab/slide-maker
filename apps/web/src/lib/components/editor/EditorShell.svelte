<script lang="ts">
  import { untrack } from 'svelte'
  import ChatPanel from '$lib/components/chat/ChatPanel.svelte'
  import SlideOutline from '$lib/components/outline/SlideOutline.svelte'
  import SlideCanvas from '$lib/components/canvas/SlideCanvas.svelte'
  import ResourcePanel from '$lib/components/resources/ResourcePanel.svelte'
  import PlanWizard from '$lib/components/plan/PlanWizard.svelte'
  import { base } from '$app/paths'
  import { switchToChat } from '$lib/stores/chat'
  import { planWizardOpen } from '$lib/stores/plan-wizard'

  let { editable = true }: { editable?: boolean } = $props()

  let leftWidth = $state(280)
  let leftCollapsed = $state(false)
  let leftTab = $state<'chat' | 'slides' | 'resources'>('chat')

  let draggingLeft = $state(false)

  // Canvas mode — bound to SlideCanvas
  let canvasMode = $state<'edit' | 'view'>('edit')

  // Saved panel state for view/edit toggle
  let savedLeft = false

  // Only react to canvasMode changes, not panel state
  $effect(() => {
    const mode = canvasMode
    untrack(() => {
      if (mode === 'view') {
        savedLeft = leftCollapsed
        leftCollapsed = true
      } else {
        leftCollapsed = savedLeft
      }
    })
  })

  // Switch to chat tab when requested by other components
  $effect(() => {
    if ($switchToChat) {
      leftTab = 'chat'
      leftCollapsed = false
      switchToChat.set(false)
    }
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

  // Ensure slides (center) remain visible on narrow viewports
  const NARROW_BP = 1024
  function handleResize() {
    const narrow = window.innerWidth < NARROW_BP
    if (narrow) {
      leftCollapsed = true
    } else {
      leftCollapsed = savedLeft
    }
  }

  $effect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })


</script>

<div class="editor-outer">
  <a href="#slide-canvas" class="skip-link">Skip to slide canvas</a>
  <div class="editor-wrapper">
    {#if !leftCollapsed}
      <div class="left-panel" style:width="{leftWidth}px" style:min-width="{leftWidth}px">
        <div class="app-title-bar">
          <a href="{base}/" class="brand-link"><span class="brand-slide">Slide</span> <span class="brand-wiz">Wiz</span></a>
          <a href="https://ailab.gc.cuny.edu" target="_blank" rel="noopener" class="title-logo-link">
            <img src="{base}/cuny-ai-lab-logo.png" alt="CUNY AI Lab" class="title-logo" />
          </a>
        </div>
        <div class="left-tab-bar" role="tablist" aria-label="Left panel">
          <button
            class="left-tab-btn"
            class:active={leftTab === 'chat'}
            role="tab"
            aria-selected={leftTab === 'chat'}
            onclick={() => leftTab = 'chat'}
          >Chat</button>
          <button
            class="left-tab-btn"
            class:active={leftTab === 'slides'}
            role="tab"
            aria-selected={leftTab === 'slides'}
            onclick={() => leftTab = 'slides'}
          >Slides</button>
          <button
            class="left-tab-btn"
            class:active={leftTab === 'resources'}
            role="tab"
            aria-selected={leftTab === 'resources'}
            onclick={() => leftTab = 'resources'}
          >Resources</button>
        </div>
        <div class="left-tab-content" role="tabpanel" aria-label={leftTab === 'chat' ? 'Chat' : leftTab === 'slides' ? 'Slides' : 'Resources'}>
          {#if leftTab === 'chat'}
            <ChatPanel />
          {:else if leftTab === 'slides'}
            <SlideOutline />
          {:else if leftTab === 'resources'}
            <ResourcePanel />
          {/if}
        </div>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div class="resize-handle left-handle" role="separator" aria-orientation="vertical" aria-label="Resize left panel" onmousedown={startLeftResize}>
        <div class="handle-line"></div>
      </div>
    {/if}

    <div class="editor-shell" class:resizing={draggingLeft}>
      <button class="collapse-btn left-collapse" onclick={() => { if (canvasMode === 'view') { canvasMode = 'edit' } else { leftCollapsed = !leftCollapsed } }} title={leftCollapsed ? 'Show panels & edit' : 'Hide left panel'}>
        {leftCollapsed ? '▶' : '◀'}
      </button>

      <main id="slide-canvas" class="center-panel">
        <SlideCanvas {editable} bind:canvasMode />
      </main>

    </div>
  </div>

  <footer class="app-footer"></footer>

  {#if $planWizardOpen}
    <PlanWizard onclose={() => planWizardOpen.set(false)} />
  {/if}
</div>

<style>
  .skip-link {
    position: absolute;
    top: -100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: var(--color-primary);
    color: #fff;
    border-radius: 4px;
    text-decoration: none;
    z-index: 1000;
    font-size: 14px;
  }

  .skip-link:focus {
    top: 8px;
  }

  .editor-outer {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .editor-wrapper {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .editor-shell {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    min-width: 0;
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
    flex-shrink: 0;
  }

  .app-title-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    min-height: 38px;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
  }

  .brand-link {
    text-decoration: none;
    display: contents;
  }

  .brand-slide {
    color: var(--color-text, #1a1a2e);
  }

  .brand-wiz {
    color: #3a6fb4;
  }

  .title-logo-link {
    margin-left: auto;
    display: flex;
    align-items: center;
    opacity: 0.55;
    transition: opacity 0.15s;
  }

  :global(html[data-editor-dark]) .title-logo-link {
    opacity: 0.85;
  }

  :global(html[data-editor-dark]) .title-logo {
    filter: brightness(0) invert(1);
  }

  .title-logo-link:hover {
    opacity: 1;
  }

  .title-logo {
    height: 26px;
    width: auto;
    object-fit: contain;
  }

  /* Left panel tab bar — mirrors ResourcePanel tab styling */
  .left-tab-bar {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: end;
    gap: 6px;
    padding: 0 8px;
    border-bottom: 1px solid var(--color-bg-tertiary, #f1f5f9);
    flex-shrink: 0;
  }

  .left-tab-btn {
    position: relative;
    padding: 8px 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
    text-align: center;
    white-space: nowrap;
    width: 100%;
  }

  .left-tab-btn:hover {
    color: var(--color-text, #1f2937);
  }

  .left-tab-btn.active { color: var(--color-primary); }
  .left-tab-btn.active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: var(--color-primary);
    border-radius: 1px;
    pointer-events: none;
  }

  .left-tab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .center-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-tertiary);
    min-width: 320px;
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

  /* App footer */
  .app-footer {
    flex-shrink: 0;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }


  /* Responsive: auto-collapse panels on narrow viewports */
  @media (max-width: 1024px) {
    .left-panel {
      max-width: 240px;
    }
  }

  @media (max-width: 860px) {
    .left-panel {
      max-width: 200px;
    }
  }

  @media (max-width: 640px) {
    .left-panel {
      display: none;
    }
    .center-panel {
      min-width: 0;
    }
  }
</style>
