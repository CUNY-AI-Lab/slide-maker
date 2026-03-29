<script lang="ts">
  import ModuleRenderer from '$lib/components/renderers/ModuleRenderer.svelte'
  import ModulePicker from '$lib/components/outline/ModulePicker.svelte'

  type Module = {
    id: string
    type: string
    data: Record<string, unknown>
    zone: string
    order: number
    stepOrder?: number | null
    [key: string]: unknown
  }

  let {
    modules,
    zone,
    editable = false,
    deckId = '',
    slideId = '',
    onReorder,
    onModuleDataChange,
    onModuleDelete,
    onEditorReady,
  }: {
    modules: Module[]
    zone: string
    editable?: boolean
    deckId?: string
    slideId?: string
    onReorder?: (zone: string, items: Module[]) => void
    onModuleDataChange?: (moduleId: string, data: Record<string, unknown>) => void
    onModuleDelete?: (moduleId: string) => void
    onEditorReady?: (editor: unknown) => void
  } = $props()

  let items = $state<Module[]>([])
  let showPicker = $state(false)
  let pickerX = $state(0)
  let pickerY = $state(0)
  let highlightedIds = $state<Set<string>>(new Set())
  let knownIds: Set<string> = new Set()

  // Shift+drag reorder state
  let draggingId = $state<string | null>(null)
  let dragOverId = $state<string | null>(null)
  let shiftHeld = $state(false)

  function onKeyDown(e: KeyboardEvent) { if (e.key === 'Shift') shiftHeld = true }
  function onKeyUp(e: KeyboardEvent) { if (e.key === 'Shift') shiftHeld = false }

  $effect(() => {
    if (editable) {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }
  })

  $effect(() => {
    items = modules.map((m) => ({ ...m }))

    const currentIds = new Set(modules.map((m) => m.id))
    if (knownIds.size > 0) {
      for (const id of currentIds) {
        if (!knownIds.has(id)) {
          highlightedIds = new Set([...highlightedIds, id])
          setTimeout(() => {
            highlightedIds = new Set([...highlightedIds].filter(h => h !== id))
          }, 1500)
        }
      }
    }
    knownIds = currentIds
  })

  // Shift+drag reorder handlers
  function handleDragStart(e: DragEvent, modId: string) {
    draggingId = modId
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', modId)
  }

  function handleDragOver(e: DragEvent, modId: string) {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dragOverId = modId
  }

  function handleDragLeave() {
    dragOverId = null
  }

  function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) {
      draggingId = null
      dragOverId = null
      return
    }

    const fromIdx = items.findIndex(m => m.id === draggingId)
    const toIdx = items.findIndex(m => m.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return

    const reordered = [...items]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    items = reordered.map((m, i) => ({ ...m, order: i }))
    onReorder?.(zone, items)

    draggingId = null
    dragOverId = null
  }

  function handleDragEnd() {
    draggingId = null
    dragOverId = null
  }

  function togglePicker(e: MouseEvent) {
    if (showPicker) {
      showPicker = false
      return
    }
    const btn = e.currentTarget as HTMLElement
    const rect = btn.getBoundingClientRect()
    pickerX = Math.min(rect.left, window.innerWidth - 320)
    pickerY = Math.max(rect.top - 280, 10)
    showPicker = true
  }

  function handleModuleAdded() {
    showPicker = false
    onReorder?.(zone, items)
  }
</script>

<div class="zone-drop" class:editable>
  {#if items.length === 0}
    <div class="empty-zone">
      {#if editable && deckId && slideId}
        <button class="add-module-btn empty-add" onclick={togglePicker}>+ Module</button>
      {:else}
        <div class="empty-hint">+ Add module</div>
      {/if}
    </div>
  {:else}
    {#each items as mod (mod.id)}
      <div
        class="module-item"
        class:just-added={highlightedIds.has(mod.id)}
        class:drag-over={dragOverId === mod.id}
        class:dragging={draggingId === mod.id}
        draggable={editable && shiftHeld ? 'true' : 'false'}
        ondragstart={(e) => handleDragStart(e, mod.id)}
        ondragover={(e) => handleDragOver(e, mod.id)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, mod.id)}
        ondragend={handleDragEnd}
      >
        <ModuleRenderer
          module={mod}
          {editable}
          onchange={(newData) => onModuleDataChange?.(mod.id, newData)}
          ondelete={() => onModuleDelete?.(mod.id)}
          oneditorready={onEditorReady}
        />
      </div>
    {/each}
    {#if editable && deckId && slideId}
      <div class="add-module-row">
        <button class="add-module-btn" onclick={togglePicker}>+ Module</button>
      </div>
    {/if}
  {/if}
</div>

{#if showPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-overlay" onclick={() => showPicker = false}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="picker-floating" style="left: {pickerX}px; top: {pickerY}px;" onclick={(e) => e.stopPropagation()}>
      <ModulePicker {deckId} {slideId} {zone} onAdd={handleModuleAdded} />
    </div>
  </div>
{/if}

<style>
  .zone-drop {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 2rem;
    flex: 1;
    padding: 0.25rem;
  }

  .empty-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 2.5rem;
    position: relative;
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.8rem;
    font-style: italic;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm, 4px);
    min-height: 2.5rem;
    width: 100%;
  }

  .module-item {
    position: relative;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm, 4px);
    font-size: 0.75rem;
    color: inherit;
    word-break: break-all;
    transition: background 0.15s ease, border-color 0.15s ease;
    border: 2px solid transparent;
  }

  .module-item:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .module-item.dragging {
    opacity: 0.4;
  }

  .module-item.drag-over {
    border-color: var(--color-primary, #3b82f6);
    background: rgba(59, 130, 246, 0.1);
  }

  .module-item.just-added {
    animation: module-glow 1.5s ease-out;
  }

  @keyframes module-glow {
    0% { box-shadow: 0 0 0 3px rgba(59, 115, 230, 0.5); }
    100% { box-shadow: 0 0 0 0 rgba(59, 115, 230, 0); }
  }

  .add-module-row {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .add-module-btn {
    font-size: 0.7rem;
    padding: 3px 10px;
    background: rgba(59, 130, 246, 0.15);
    color: rgba(59, 130, 246, 0.9);
    border: 1px dashed rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s, border-color 0.15s;
  }

  .add-module-btn:hover {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .add-module-btn.empty-add {
    padding: 6px 14px;
    font-size: 0.75rem;
  }

  .picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.15);
  }

  .picker-floating {
    position: fixed;
    z-index: 1001;
    background: var(--color-bg, white);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 4px;
    max-width: 320px;
  }
</style>
