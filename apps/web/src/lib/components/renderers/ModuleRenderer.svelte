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
      // Scale content proportionally — both up and down
      const scaleX = newW / Math.max(naturalW, 1)
      const scaleY = newH / Math.max(naturalH, 1)
      scaleFactor = Math.min(scaleX, scaleY)
    }
    function onUp() {
      resizing = false
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
    <div class="module-controls">
      <div class="ctrl-group">
        {#if !isFirst}
          <button class="ctrl-btn" onclick={() => onmoveup?.()} title="Move up">▲</button>
        {/if}
        {#if !isLast}
          <button class="ctrl-btn" onclick={() => onmovedown?.()} title="Move down">▼</button>
        {/if}
      </div>
      <select
        class="step-select"
        value={module.stepOrder != null ? String(module.stepOrder) : ''}
        onchange={handleStepChange}
        title="Step reveal order"
      >
        <option value="">Step</option>
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
    top: 4px;
    right: 4px;
    display: none;
    align-items: center;
    gap: 2px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 6px);
    padding: 2px 3px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(4px);
  }
  .module-wrapper.editable:hover .module-controls,
  .module-wrapper.editable:focus-within .module-controls {
    display: flex;
  }

  .ctrl-group {
    display: flex;
    gap: 1px;
  }

  .ctrl-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
    padding: 0;
    font-family: var(--font-body);
    line-height: 1;
    transition: background 0.1s, color 0.1s;
  }
  .ctrl-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
  }
  .step-select {
    height: 26px;
    font-size: 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted, #6b7280);
    padding: 0 2px 0 6px;
    cursor: pointer;
    font-family: var(--font-body);
    outline: none;
    transition: background 0.1s;
  }
  .step-select:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
  }
  .step-select:focus {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
  }
  .delete-btn:hover {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.06);
  }
  .delete-btn.confirming {
    color: white;
    background: #dc2626;
    font-weight: 600;
    border-radius: 4px;
    width: auto;
    padding: 0 8px;
    font-size: 10px;
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
