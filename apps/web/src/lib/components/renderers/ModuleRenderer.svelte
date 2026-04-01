<script lang="ts">
  import HeadingModule from './HeadingModule.svelte'
  import TextModule from './TextModule.svelte'
  import CardModule from './CardModule.svelte'
  import LabelModule from './LabelModule.svelte'
  import TipBoxModule from './TipBoxModule.svelte'
  import PromptBlockModule from './PromptBlockModule.svelte'
  import ImageModule from './ImageModule.svelte'
  import CarouselModule from './CarouselModule.svelte'
  import ComparisonModule from './ComparisonModule.svelte'
  import CardGridModule from './CardGridModule.svelte'
  import FlowModule from './FlowModule.svelte'
  import StreamListModule from './StreamListModule.svelte'
  import ArtifactModule from './ArtifactModule.svelte'

  import type { Editor } from '@tiptap/core'
  import { activeModuleControls } from '$lib/stores/ui'

  let { module, editable = false, onchange, oneditorready, ondelete, onmoveup, onmovedown, onstepchange, isFirst = false, isLast = false }: {
    module: { id: string; type: string; data: Record<string, unknown>; stepOrder?: number | null };
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    ondelete?: () => void;
    onmoveup?: () => void;
    onmovedown?: () => void;
    onstepchange?: (stepOrder: number | null) => void;
    isFirst?: boolean;
    isLast?: boolean;
  } = $props()

  function handleStepChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value
    const step = val === '' ? null : Number(val)
    onstepchange?.(step)
  }

  // Popover controls state
  let triggerEl: HTMLButtonElement | undefined = $state()
  let popX = $state(0)
  let popY = $state(0)
  let isActive = $derived($activeModuleControls === module.id)

  function toggleControls(e: MouseEvent) {
    e.stopPropagation()
    if (isActive) {
      activeModuleControls.set(null)
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      popX = rect.right + 4
      popY = rect.top
      // Clamp so popover doesn't go off-screen
      if (popX + 160 > window.innerWidth) popX = rect.left - 164
      if (popY + 140 > window.innerHeight) popY = window.innerHeight - 144
      activeModuleControls.set(module.id)
    }
  }

  // Close on Escape or outside click
  $effect(() => {
    if (!isActive) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') activeModuleControls.set(null)
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.module-popover') && !target.closest('.module-trigger')) {
        activeModuleControls.set(null)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick, true)
    }
  })

  const rendererMap: Record<string, any> = {
    heading: HeadingModule,
    text: TextModule,
    card: CardModule,
    label: LabelModule,
    'tip-box': TipBoxModule,
    'prompt-block': PromptBlockModule,
    image: ImageModule,
    carousel: CarouselModule,
    comparison: ComparisonModule,
    'card-grid': CardGridModule,
    flow: FlowModule,
    'stream-list': StreamListModule,
    artifact: ArtifactModule,
  }

  let Renderer = $derived(rendererMap[module.type] ?? null)

  // Delete
  let confirmDelete = $state(false)
  function handleDelete() {
    if (confirmDelete) {
      ondelete?.()
      confirmDelete = false
    } else {
      confirmDelete = true
      setTimeout(() => { confirmDelete = false }, 3000)
    }
  }

  // Corner resize — sets custom dimensions, triggers CSS scale-down
  let wrapperEl: HTMLDivElement | undefined = $state()
  let customW = $state<number | null>(null)
  let customH = $state<number | null>(null)
  let resizing = $state(false)
  let scaleFactor = $state(1)

  // Resize dimension tooltip
  let resizeLabel = $state('')

  function startResize(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizing = true
    const startX = e.clientX
    const startY = e.clientY
    const rect = wrapperEl!.getBoundingClientRect()
    const startW = rect.width
    const startH = rect.height
    const naturalW = wrapperEl!.scrollWidth
    const naturalH = wrapperEl!.scrollHeight

    function onMove(ev: MouseEvent) {
      const newW = Math.max(60, startW + (ev.clientX - startX))
      const newH = Math.max(30, startH + (ev.clientY - startY))
      customW = newW
      customH = newH
      resizeLabel = `${Math.round(newW)} × ${Math.round(newH)}`
      // Scale content down only — enlarging gives more reflow space instead of zooming
      const scaleX = newW / Math.max(naturalW, 1)
      const scaleY = newH / Math.max(naturalH, 1)
      scaleFactor = Math.min(scaleX, scaleY, 1)
    }
    function onUp() {
      resizing = false
      resizeLabel = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Persist resize for artifact/image modules
      if (customW && customH && (module.type === 'artifact' || module.type === 'image')) {
        onchange?.({ ...module.data, width: `${Math.round(customW)}px`, height: `${Math.round(customH)}px` })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
</script>

<div
  class="module-wrapper"
  class:editable
  class:is-step={module.stepOrder != null}
  class:resizing
  bind:this={wrapperEl}
  style:width={customW ? `${customW}px` : undefined}
  style:height={customH ? `${customH}px` : undefined}
>
  {#if editable}
    <button
      class="module-trigger"
      class:active={isActive}
      bind:this={triggerEl}
      onclick={toggleControls}
      title="Module actions"
      aria-label="Module actions"
      aria-expanded={isActive}
    >⋯</button>
  {/if}

  {#if isActive}
    <div class="module-popover" role="toolbar" aria-label="Module controls" style="left: {popX}px; top: {popY}px;">
      <div class="pop-section">
        <span class="pop-label">Move</span>
        <div class="pop-row">
          <button class="pop-btn" aria-label="Move up" onclick={() => onmoveup?.()} disabled={isFirst} title="Move up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="pop-btn" aria-label="Move down" onclick={() => onmovedown?.()} disabled={isLast} title="Move down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
      <div class="pop-divider"></div>
      <div class="pop-section">
        <span class="pop-label">Step reveal</span>
        <select
          class="pop-select"
          value={module.stepOrder != null ? String(module.stepOrder) : ''}
          onchange={handleStepChange}
          aria-label="Step reveal order"
        >
          <option value="">None</option>
          <option value="0">1</option>
          <option value="1">2</option>
          <option value="2">3</option>
          <option value="3">4</option>
          <option value="4">5</option>
          <option value="5">6</option>
          <option value="6">7</option>
          <option value="7">8</option>
          <option value="8">9</option>
        </select>
      </div>
      <div class="pop-divider"></div>
      <button
        class="pop-btn pop-delete"
        class:confirming={confirmDelete}
        onclick={handleDelete}
        title={confirmDelete ? 'Click again to confirm' : 'Delete module'}
        aria-label={confirmDelete ? 'Confirm delete' : 'Delete module'}
      >
        {confirmDelete ? 'Confirm delete' : 'Delete'}
      </button>
    </div>
  {/if}

  {#if module.stepOrder != null}
    <span class="step-badge">Step {module.stepOrder + 1}</span>
  {/if}

  <div class="module-content" style:transform={scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined} style:transform-origin={scaleFactor !== 1 ? 'top center' : undefined}>
    {#if Renderer}
      <Renderer data={module.data} {editable} {onchange} oneditorready={module.type === 'text' ? oneditorready : undefined} />
    {:else}
      <div class="unknown-module">Unknown: {module.type}</div>
    {/if}
  </div>

  {#if editable}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="corner-resize" onmousedown={startResize}></div>
    {#if resizeLabel}
      <div class="resize-tooltip">{resizeLabel}</div>
    {/if}
  {/if}
</div>

<style>
  .module-wrapper {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .module-wrapper.editable {
    outline: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-sm);
  }
  .module-wrapper.editable:hover {
    outline-color: rgba(59, 115, 230, 0.4);
    transition: outline-color 0.15s ease;
  }
  .module-wrapper.resizing {
    user-select: none;
    outline: 2px solid var(--color-primary) !important;
  }
  .is-step {
    opacity: 0.7;
    border-left: 3px solid var(--teal, #2FB8D6);
    padding-left: 8px;
  }
  .step-badge {
    position: absolute;
    top: -8px;
    left: -3px;
    background: var(--teal, #2FB8D6);
    color: white;
    font-size: 9px;
    padding: 1px 7px;
    border-radius: 0 8px 8px 0;
    font-weight: 700;
    letter-spacing: 0.03em;
    z-index: 5;
    text-transform: uppercase;
  }

  .module-content {
    width: 100%;
  }

  /* Trigger dot — top-right, appears on hover */
  .module-trigger {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    letter-spacing: 1px;
    background: rgba(20, 30, 50, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    z-index: 10;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
    padding: 0;
    backdrop-filter: blur(6px);
  }
  .module-trigger.active {
    opacity: 1;
    pointer-events: auto;
    background: rgba(59, 115, 230, 0.9);
    color: white;
    border-color: rgba(59, 115, 230, 0.6);
  }
  .module-wrapper.editable:hover .module-trigger {
    opacity: 1;
    pointer-events: auto;
  }
  .module-trigger:hover:not(.active) {
    background: rgba(40, 55, 85, 0.95);
    color: rgba(255, 255, 255, 0.9);
  }

  /* Popover — fixed, escapes all overflow */
  .module-popover {
    position: fixed;
    z-index: 1000;
    background: rgba(18, 25, 42, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px;
    min-width: 140px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pop-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 2px 4px;
  }

  .pop-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .pop-row {
    display: flex;
    gap: 2px;
  }

  .pop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 0;
    transition: background 0.1s, color 0.1s;
  }
  .pop-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  .pop-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .pop-select {
    height: 26px;
    font-size: 11px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.8);
    padding: 0 6px;
    cursor: pointer;
    font-family: var(--font-body);
    outline: none;
  }
  .pop-select:hover { border-color: rgba(255, 255, 255, 0.25); }
  .pop-select:focus-visible { border-color: rgba(59, 115, 230, 0.6); }

  .pop-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
  }

  .pop-delete {
    width: 100%;
    height: auto;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 120, 120, 0.85);
    justify-content: center;
  }
  .pop-delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    color: #ff6b6b;
  }
  .pop-delete.confirming {
    background: #ef4444;
    color: white;
    font-weight: 600;
  }

  /* Corner resize — fade in on hover */
  .corner-resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .corner-resize::after {
    content: '';
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--color-primary);
    border-bottom: 2px solid var(--color-primary);
    opacity: 0.5;
    transition: opacity 0.1s;
  }
  .module-wrapper.editable:hover .corner-resize {
    opacity: 1;
  }
  .corner-resize:hover::after {
    opacity: 1;
  }

  /* Resize dimension tooltip */
  .resize-tooltip {
    position: absolute;
    bottom: -22px;
    right: 0;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
    z-index: 20;
    pointer-events: none;
  }

  .unknown-module {
    padding: 0.5rem;
    background: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 0.8rem;
    text-align: center;
  }
</style>
