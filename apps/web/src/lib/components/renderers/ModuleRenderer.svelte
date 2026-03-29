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
      // Scale content to fit the new size
      const scaleX = newW / Math.max(naturalW, 1)
      const scaleY = newH / Math.max(naturalH, 1)
      scaleFactor = Math.min(scaleX, scaleY, 1) // Never scale up, only down
    }
    function onUp() {
      resizing = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
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
    <div class="module-controls">
      {#if !isFirst}
        <button class="ctrl-btn" onclick={() => onmoveup?.()} title="Move up">▲</button>
      {/if}
      {#if !isLast}
        <button class="ctrl-btn" onclick={() => onmovedown?.()} title="Move down">▼</button>
      {/if}
      <select
        class="step-select"
        value={module.stepOrder != null ? String(module.stepOrder) : ''}
        onchange={handleStepChange}
        title="Step reveal order"
      >
        <option value="">--</option>
        <option value="0">1</option>
        <option value="1">2</option>
        <option value="2">3</option>
        <option value="3">4</option>
        <option value="4">5</option>
      </select>
      <button
        class="ctrl-btn delete-btn"
        class:confirming={confirmDelete}
        onclick={handleDelete}
        title={confirmDelete ? 'Click again to confirm' : 'Delete module'}
      >
        {confirmDelete ? 'Delete?' : '✕'}
      </button>
    </div>
  {/if}

  {#if module.stepOrder != null}
    <span class="step-badge">Step {module.stepOrder + 1}</span>
  {/if}

  <div class="module-content" style:transform={scaleFactor < 1 ? `scale(${scaleFactor})` : undefined} style:transform-origin={scaleFactor < 1 ? 'top center' : undefined}>
    {#if Renderer}
      <Renderer data={module.data} {editable} {onchange} oneditorready={module.type === 'text' ? oneditorready : undefined} />
    {:else}
      <div class="unknown-module">Unknown: {module.type}</div>
    {/if}
  </div>

  {#if editable}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="corner-resize" onmousedown={startResize}></div>
  {/if}
</div>

<style>
  .module-wrapper {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .module-wrapper.editable:hover {
    outline: 1px dashed rgba(59, 115, 230, 0.4);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
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
    top: -10px;
    right: 50px;
    background: var(--teal, #2FB8D6);
    color: white;
    font-size: 10px;
    padding: 1px 8px;
    border-radius: 10px;
    font-weight: 600;
    z-index: 5;
  }

  .module-content {
    width: 100%;
  }

  /* Controls */
  .module-controls {
    position: absolute;
    top: -8px;
    right: 2px;
    display: none;
    align-items: center;
    gap: 3px;
    z-index: 10;
  }
  .module-wrapper.editable:hover .module-controls {
    display: flex;
  }

  .ctrl-btn {
    width: auto;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--color-border);
    border-radius: 9px;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0 4px;
    font-family: var(--font-body);
    line-height: 1;
  }
  .step-select {
    height: 18px;
    font-size: 9px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.9);
    color: var(--color-text-muted);
    padding: 0 4px;
    cursor: pointer;
    font-family: var(--font-body);
    outline: none;
  }
  .step-select:focus {
    border-color: var(--teal, #2FB8D6);
  }
  .delete-btn:hover {
    color: #dc2626;
    border-color: #dc2626;
    background: #fef2f2;
  }
  .delete-btn.confirming {
    color: white;
    background: #dc2626;
    border-color: #dc2626;
    padding: 0 6px;
    font-weight: 600;
  }

  /* Corner resize */
  .corner-resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    z-index: 10;
    display: none;
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
  }
  .module-wrapper.editable:hover .corner-resize {
    display: block;
  }
  .corner-resize:hover::after {
    opacity: 1;
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
