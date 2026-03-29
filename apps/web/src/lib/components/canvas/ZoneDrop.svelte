<script lang="ts">
  import { dndzone } from 'svelte-dnd-action'
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
    onEditorReady,
  }: {
    modules: Module[]
    zone: string
    editable?: boolean
    deckId?: string
    slideId?: string
    onReorder?: (zone: string, items: Module[]) => void
    onModuleDataChange?: (moduleId: string, data: Record<string, unknown>) => void
    onEditorReady?: (editor: unknown) => void
  } = $props()

  let items = $state<Module[]>([])
  let showPicker = $state(false)
  let prevModuleIds = $state<Set<string>>(new Set())
  let highlightedIds = $state<Set<string>>(new Set())

  $effect(() => {
    items = modules.map((m) => ({ ...m }))
  })

  $effect(() => {
    const currentIds = new Set(modules.map((m) => m.id))
    for (const id of currentIds) {
      if (!prevModuleIds.has(id)) {
        highlightedIds.add(id)
        setTimeout(() => {
          highlightedIds.delete(id)
          highlightedIds = new Set(highlightedIds)
        }, 1500)
      }
    }
    prevModuleIds = currentIds
  })

  function handleConsider(e: CustomEvent<{ items: Module[] }>) {
    items = e.detail.items
  }

  function handleFinalize(e: CustomEvent<{ items: Module[] }>) {
    items = e.detail.items
    onReorder?.(zone, items)
  }

  function togglePicker() {
    showPicker = !showPicker
  }

  function handleModuleAdded() {
    showPicker = false
    // Trigger a refresh by dispatching - parent will re-fetch
    onReorder?.(zone, items)
  }

  function handlePickerClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.picker-wrapper') && !target.closest('.add-module-btn')) {
      showPicker = false
    }
  }

  $effect(() => {
    if (showPicker) {
      document.addEventListener('click', handlePickerClickOutside, true)
      return () => document.removeEventListener('click', handlePickerClickOutside, true)
    }
  })
</script>

<div
  class="zone-drop"
  class:editable
  use:dndzone={{
    items,
    dropTargetStyle: { outline: '2px dashed rgba(59,130,246,0.4)', borderRadius: '4px' },
    type: 'modules',
  }}
  onconsider={handleConsider}
  onfinalize={handleFinalize}
>
  {#if items.length === 0}
    <div class="empty-zone">
      {#if editable && deckId && slideId}
        <button class="add-module-btn empty-add" onclick={togglePicker}>+ Module</button>
        {#if showPicker}
          <div class="picker-wrapper picker-centered">
            <ModulePicker {deckId} {slideId} {zone} onAdd={handleModuleAdded} />
          </div>
        {/if}
      {:else}
        <div class="empty-hint">+ Add module</div>
      {/if}
    </div>
  {:else}
    {#each items as mod (mod.id)}
      <div class="module-item" class:just-added={highlightedIds.has(mod.id)}>
        <ModuleRenderer
          module={mod}
          {editable}
          onchange={(newData) => onModuleDataChange?.(mod.id, newData)}
          oneditorready={onEditorReady}
        />
      </div>
    {/each}
    {#if editable && deckId && slideId}
      <div class="add-module-row">
        <button class="add-module-btn" onclick={togglePicker}>+ Module</button>
        {#if showPicker}
          <div class="picker-wrapper">
            <ModulePicker {deckId} {slideId} {zone} onAdd={handleModuleAdded} />
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .zone-drop {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 2rem;
    flex: 1;
    padding: 0.25rem;
  }

  .zone-drop.editable {
    border-radius: var(--radius-sm, 4px);
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
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm, 4px);
    font-size: 0.75rem;
    color: inherit;
    word-break: break-all;
    cursor: grab;
    transition: background 0.15s ease;
  }

  .module-item:hover {
    background: rgba(255, 255, 255, 0.14);
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

  .picker-wrapper {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    z-index: 60;
  }

  .picker-centered {
    top: auto;
    bottom: auto;
    margin-top: 8px;
  }
</style>
