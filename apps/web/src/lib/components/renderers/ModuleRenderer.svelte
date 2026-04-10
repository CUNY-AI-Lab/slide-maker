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
  import VideoModule from './VideoModule.svelte'

  import type { Editor } from '@tiptap/core'
  import { dragHandle } from 'svelte-dnd-action'
  import { activeModuleControls } from '$lib/stores/ui'

  let { module, slideId = '', editable = false, onchange, onresize, oneditorready, oneditorblur, ondelete, onstepchange }: {
    module: { id: string; type: string; data: Record<string, unknown>; stepOrder?: number | null };
    slideId?: string;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    onresize?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
    ondelete?: () => void;
    onstepchange?: (stepOrder: number | null) => void;
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
      const trigger = e.currentTarget as HTMLElement
      const rect = trigger.getBoundingClientRect()
      const popW = 160
      const popH = 140
      // Find canvas bounds to keep popover inside the slide area
      const canvas = trigger.closest('.slide-frame') ?? trigger.closest('.canvas-area')
      const bounds = canvas?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
      // Default: right of trigger
      popX = rect.right + 4
      popY = rect.top
      // Clamp horizontally within canvas bounds
      if (popX + popW > bounds.right) popX = rect.left - popW - 4
      if (popX < bounds.left) popX = bounds.left + 4
      // Clamp vertically within canvas bounds
      if (popY + popH > bounds.bottom) popY = bounds.bottom - popH - 4
      if (popY < bounds.top) popY = bounds.top + 4
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
    video: VideoModule,
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

  // Corner resize — pointer events with capture, shift-drag aspect lock
  const PERSISTABLE_RESIZE_TYPES = ['artifact', 'image', 'text', 'heading', 'card', 'tip-box', 'prompt-block', 'comparison', 'card-grid', 'flow', 'stream-list', 'carousel', 'label', 'video']
  let wrapperEl: HTMLDivElement | undefined = $state()
  let customW = $state<number | null>(null)
  let customH = $state<number | null>(null)
  let resizing = $state(false)
  let scaleFactor = $state(1)
  let resizeLabel = $state('')

  // Captured at drag start
  let _resizeStartX = 0
  let _resizeStartY = 0
  let _resizeStartW = 0
  let _resizeStartH = 0
  let _resizeNaturalW = 0
  let _resizeNaturalH = 0
  let _resizeAspect = 1

  let _resizeCorner: 'tl' | 'tr' | 'bl' | 'br' = 'br'

  function handleResizeDown(e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    _resizeCorner = ((e.currentTarget as HTMLElement).dataset.corner as typeof _resizeCorner) || 'br'
    resizing = true
    _resizeStartX = e.clientX
    _resizeStartY = e.clientY
    const rect = wrapperEl!.getBoundingClientRect()
    _resizeStartW = rect.width
    _resizeStartH = rect.height
    _resizeNaturalW = wrapperEl!.scrollWidth
    _resizeNaturalH = wrapperEl!.scrollHeight
    _resizeAspect = _resizeStartW / Math.max(_resizeStartH, 1)
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizing) return
    const dx = e.clientX - _resizeStartX
    const dy = e.clientY - _resizeStartY
    // Flip delta direction based on which corner is dragged
    const sx = _resizeCorner.includes('l') ? -1 : 1
    const sy = _resizeCorner.includes('t') ? -1 : 1
    let newW = Math.max(160, _resizeStartW + dx * sx)
    let newH = Math.max(60, _resizeStartH + dy * sy)
    if (e.shiftKey) {
      newH = newW / _resizeAspect
      if (newH < 60) { newH = 60; newW = newH * _resizeAspect }
    }
    customW = newW
    customH = newH
    resizeLabel = `${Math.round(newW)} × ${Math.round(newH)}${e.shiftKey ? ' ⊟' : ''}`
    const scaleX = newW / Math.max(_resizeNaturalW, 1)
    const scaleY = newH / Math.max(_resizeNaturalH, 1)
    scaleFactor = Math.min(scaleX, scaleY, 1)
  }

  function handleResizeUp(e: PointerEvent) {
    if (!resizing) return
    resizing = false
    resizeLabel = ''
    // Persist resize for artifact/image via mutation-routed callback
    if (customW && customH && PERSISTABLE_RESIZE_TYPES.includes(module.type)) {
      const next: Record<string, unknown> = { ...module.data, width: `${Math.round(customW)}px`, height: `${Math.round(customH)}px` }
      if (module.type === 'artifact') next.autoSize = false
      onresize?.(next)
    }
    // Always reset visual state — non-persisted types lose resize on release
    customW = null
    customH = null
    scaleFactor = 1
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
    <span class="canvas-drag-handle" use:dragHandle aria-label="Drag to reorder">⠿</span>
    <button
      class="module-trigger"
      class:active={isActive}
      bind:this={triggerEl}
      onclick={toggleControls}
      aria-label="Module actions"
      aria-expanded={isActive}
    >⋯</button>
  {/if}

  {#if isActive}
    <div class="module-popover" role="toolbar" aria-label="Module controls" style="left: {popX}px; top: {popY}px;">
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
      {#if module.type === 'artifact'}
        <ArtifactModule data={module.data} moduleId={module.id} {slideId} {editable} {onchange} />
      {:else}
        <Renderer data={module.data} {editable} {onchange} {oneditorready} {oneditorblur} />
      {/if}
    {:else}
      <div class="unknown-module">Unknown: {module.type}</div>
    {/if}
  </div>

  {#if editable}
    {#each ['tl', 'tr', 'bl', 'br'] as corner (corner)}
      <div
        class="corner-resize corner-{corner}"
        data-corner={corner}
        role="separator"
        aria-label="Resize module"
        onpointerdown={handleResizeDown}
        onpointermove={handleResizeMove}
        onpointerup={handleResizeUp}
        onpointercancel={handleResizeUp}
      ></div>
    {/each}
    {#if resizeLabel}
      <div class="resize-tooltip">{resizeLabel}</div>
    {/if}
  {/if}
</div>

<style>
  .module-wrapper {
    position: relative;
    width: 100%;
    overflow: visible;
  }
  .module-wrapper.editable {
    border-radius: var(--radius-sm, 6px);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    transition: box-shadow 0.15s ease;
  }
  .module-wrapper.editable:hover {
    box-shadow: inset 0 0 0 1px rgba(59, 115, 230, 0.35);
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
    top: 0;
    left: 0;
    background: var(--teal, #2FB8D6);
    color: white;
    font-size: 8px;
    padding: 0 5px;
    border-radius: 0 0 4px 0;
    font-weight: 700;
    letter-spacing: 0.03em;
    z-index: 5;
    text-transform: uppercase;
    line-height: 14px;
  }

  .module-content {
    width: 100%;
  }
  .module-wrapper.editable > .module-content {
    padding-top: 20px;
  }

  /* Drag handle — top-left, appears on hover */
  .canvas-drag-handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(17, 24, 39, 0.18);
    border-radius: 3px;
    color: #1f2937; /* slate-800 */
    cursor: grab;
    z-index: 10;
    opacity: 0;
    pointer-events: auto;
    touch-action: none;
    transition: opacity 0.12s, background 0.12s, border-color 0.12s, color 0.12s;
    backdrop-filter: saturate(160%) blur(6px);
  }
  .module-wrapper.editable:hover .canvas-drag-handle,
  .module-wrapper.editable .canvas-drag-handle:focus-visible {
    opacity: 1;
  }

  /* Trigger dot — top-right, appears on hover */
  .module-trigger {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 1px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(17, 24, 39, 0.18);
    border-radius: 3px;
    color: #1f2937;
    cursor: pointer;
    z-index: 10;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s, background 0.12s, color 0.12s, border-color 0.12s;
    padding: 0;
    backdrop-filter: saturate(160%) blur(6px);
  }
  /* Enlarge tap target to 44x44 without changing visual size */
  .module-trigger::after {
    content: '';
    position: absolute;
    inset: -14px;
  }
  .module-trigger.active {
    opacity: 1;
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.96);
    color: #1f2937;
    border-color: rgba(59, 115, 230, 0.55);
    box-shadow: 0 0 0 2px rgba(59, 115, 230, 0.25);
  }
  .module-wrapper.editable:hover .module-trigger {
    opacity: 1;
    pointer-events: auto;
  }
  .module-trigger:hover:not(.active) {
    background: rgba(255, 255, 255, 0.9);
    color: #111827;
    border-color: rgba(17, 24, 39, 0.28);
  }

  /* Popover — fixed, escapes all overflow */
  .module-popover {
    position: fixed;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(17, 24, 39, 0.12);
    border-radius: 8px;
    padding: 6px;
    min-width: 140px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    backdrop-filter: saturate(140%) blur(12px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #111827;
  }

  .pop-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 4px;
  }

  .pop-label {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280; /* slate-500 */
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* removed unused .pop-row */

  .pop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(17, 24, 39, 0.15);
    border-radius: 6px;
    color: #1f2937;
    cursor: pointer;
    padding: 0;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }
  .pop-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.9);
    color: #111827;
    border-color: rgba(17, 24, 39, 0.25);
  }
  .pop-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pop-select {
    height: 22px;
    font-size: 10px;
    border: 1px solid rgba(17, 24, 39, 0.2);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    color: #111827;
    padding: 0 6px;
    cursor: pointer;
    font-family: var(--font-body);
    outline: none;
  }
  .pop-select:hover { border-color: rgba(17, 24, 39, 0.3); }
  .pop-select:focus-visible { border-color: rgba(59, 115, 230, 0.6); box-shadow: 0 0 0 2px rgba(59, 115, 230, 0.25); }

  .pop-divider {
    height: 1px;
    background: rgba(17, 24, 39, 0.08);
    margin: 2px 0;
  }

  .pop-delete {
    width: 100%;
    height: auto;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-error);
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent);
    background: rgba(255, 255, 255, 0.86);
    border-radius: 6px;
  }
  .pop-delete:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-error) 10%, white);
    border-color: color-mix(in srgb, var(--color-error) 55%, transparent);
  }
  .pop-delete.confirming {
    background: var(--color-error);
    color: white;
    font-weight: 700;
    border-color: var(--color-error);
  }

  /* Corner resize handles — all four corners, fade in on hover */
  .corner-resize {
    position: absolute;
    width: 16px;
    height: 16px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.15s ease;
    touch-action: none;
  }
  .corner-resize::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    opacity: 0.5;
    transition: opacity 0.1s;
  }
  .corner-br { bottom: 0; right: 0; cursor: nwse-resize; }
  .corner-br::after { bottom: 2px; right: 2px; border-right: 2px solid var(--color-primary); border-bottom: 2px solid var(--color-primary); }
  .corner-bl { bottom: 0; left: 0; cursor: nesw-resize; }
  .corner-bl::after { bottom: 2px; left: 2px; border-left: 2px solid var(--color-primary); border-bottom: 2px solid var(--color-primary); }
  .corner-tr { top: 0; right: 0; cursor: nesw-resize; }
  .corner-tr::after { top: 2px; right: 2px; border-right: 2px solid var(--color-primary); border-top: 2px solid var(--color-primary); }
  .corner-tl { top: 0; left: 0; cursor: nwse-resize; }
  .corner-tl::after { top: 2px; left: 2px; border-left: 2px solid var(--color-primary); border-top: 2px solid var(--color-primary); }
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
