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
      // Scale content proportionally — both up and down
      const scaleX = newW / Math.max(naturalW, 1)
      const scaleY = newH / Math.max(naturalH, 1)
      scaleFactor = Math.min(scaleX, scaleY)
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
    <div class="module-controls" role="toolbar" aria-label="Module controls">
      <div class="ctrl-group">
        {#if !isFirst}
          <button class="ctrl-btn" aria-label="Move module up" onclick={() => onmoveup?.()} title="Move up">▲</button>
        {/if}
        {#if !isLast}
          <button class="ctrl-btn" aria-label="Move module down" onclick={() => onmovedown?.()} title="Move down">▼</button>
        {/if}
      </div>
      <select
        class="step-select"
        value={module.stepOrder != null ? String(module.stepOrder) : ''}
        onchange={handleStepChange}
        title="Step reveal order"
        aria-label="Step reveal order"
      >
        <option value="">Step</option>
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
      <button
        class="ctrl-btn delete-btn"
        class:confirming={confirmDelete}
        onclick={handleDelete}
        title={confirmDelete ? 'Click again to confirm' : 'Delete module'}
        aria-label={confirmDelete ? 'Confirm delete module' : 'Delete module'}
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
  .module-wrapper.editable:hover {
    outline: 1px dashed rgba(59, 115, 230, 0.3);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
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

  /* Controls — fade in/out */
  .module-controls {
    position: absolute;
    bottom: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    padding: 3px 5px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(6px);
    opacity: 0;
    pointer-events: none;
    transform: translateY(2px);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .module-wrapper.editable:hover .module-controls,
  .module-wrapper.editable:focus-within .module-controls {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .ctrl-group {
    display: flex;
    gap: 1px;
  }

  .ctrl-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
    padding: 0;
    font-family: var(--font-body);
    line-height: 1;
    transition: background 0.1s, color 0.1s, box-shadow 0.1s;
  }
  .ctrl-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
  }
  .ctrl-btn:focus-visible {
    outline: 2px solid var(--color-primary, #3B73E6);
    outline-offset: 1px;
    box-shadow: 0 0 0 2px rgba(59, 115, 230, 0.2);
  }
  .step-select {
    height: 28px;
    font-size: 11px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    background: white;
    color: var(--color-text, #1f2937);
    padding: 0 6px;
    cursor: pointer;
    font-family: var(--font-body);
    outline: none;
    transition: background 0.1s, border-color 0.1s, box-shadow 0.1s, color 0.1s;
  }
  .step-select:hover { border-color: var(--color-text-muted, #94a3b8); }
  .step-select:focus-visible { border-color: var(--color-primary, #3B73E6); box-shadow: 0 0 0 2px rgba(59, 115, 230, 0.15); }
  .delete-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
  .delete-btn.confirming {
    color: white;
    background: #ef4444;
    font-weight: 600;
    border-radius: var(--radius-sm, 6px);
    width: auto;
    padding: 6px 10px;
    font-size: 13px;
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
