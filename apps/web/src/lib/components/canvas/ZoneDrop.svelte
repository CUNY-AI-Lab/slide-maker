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
    onModuleStepChange,
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
    onModuleStepChange?: (moduleId: string, stepOrder: number | null) => void
    onEditorReady?: (editor: unknown) => void
  } = $props()

  let items = $state<Module[]>([])
  let showPicker = $state(false)
  let pickerX = $state(0)
  let pickerY = $state(0)
  let highlightedIds = $state<Set<string>>(new Set())
  let knownIds: Set<string> = new Set()

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

  function moveModule(modId: string, direction: 'up' | 'down') {
    const idx = items.findIndex(m => m.id === modId)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length) return

    const reordered = [...items]
    const temp = reordered[idx]
    reordered[idx] = reordered[targetIdx]
    reordered[targetIdx] = temp

    items = reordered.map((m, i) => ({ ...m, order: i }))
    onReorder?.(zone, items)
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
  }

  // Accessibility: close picker with Escape and return focus
  let lastTrigger: HTMLElement | null = null
  $effect(() => {
    if (!showPicker) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        showPicker = false
        lastTrigger?.focus?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<div class="zone-drop" class:editable>
  {#if items.length === 0}
    <div class="empty-zone">
      {#if editable && deckId && slideId}
        <button class="add-module-btn empty-add" onclick={(e) => { lastTrigger = e.currentTarget as HTMLElement; togglePicker(e) }} aria-haspopup="dialog" aria-expanded={showPicker}>+ Module</button>
      {:else}
        <div class="empty-hint">+ Add module</div>
      {/if}
    </div>
  {:else}
    {#each items as mod, i (mod.id)}
      <div class="module-item" class:just-added={highlightedIds.has(mod.id)}>
        <ModuleRenderer
          module={mod}
          {editable}
          onchange={(newData) => onModuleDataChange?.(mod.id, newData)}
          ondelete={() => onModuleDelete?.(mod.id)}
          onmoveup={() => moveModule(mod.id, 'up')}
          onmovedown={() => moveModule(mod.id, 'down')}
          onstepchange={(step) => onModuleStepChange?.(mod.id, step)}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          oneditorready={onEditorReady}
        />
      </div>
    {/each}
    {#if editable && deckId && slideId}
      <div class="add-module-row">
        <button class="add-module-btn" onclick={(e) => { lastTrigger = e.currentTarget as HTMLElement; togglePicker(e) }} aria-haspopup="dialog" aria-expanded={showPicker}>+ Module</button>
      </div>
    {/if}
  {/if}
</div>

{#if showPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-overlay" onclick={() => showPicker = false}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="picker-floating" role="dialog" aria-label="Add module" style="left: {pickerX}px; top: {pickerY}px;" onclick={(e) => e.stopPropagation()}>
      <ModulePicker {deckId} {slideId} {zone} onAdd={handleModuleAdded} />
    </div>
  </div>
{/if}

<style>
  .zone-drop {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    min-height: 2rem;
    flex: 1;
    padding: 0;
    container-type: inline-size;
  }

  .empty-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 2.5rem;
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.9375rem;
    font-style: italic;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm, 4px);
    min-height: 2.5rem;
    width: 100%;
  }

  .module-item {
    position: relative;
    padding: 4px 0;
    background: transparent;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.875rem;
    color: inherit;
    /* Avoid splitting words mid‑letters; allow long URLs/text to wrap */
    word-break: normal;
    overflow-wrap: anywhere;
    hyphens: auto;
    transition: background 0.15s ease;
  }

  /* When editing, prefer caret-stable wrapping rules inside contenteditable
     to avoid cursor jumps back to the first breakable space. */
  .zone-drop.editable .module-item {
    overflow-wrap: break-word;  /* break long tokens only when needed */
    hyphens: manual;            /* do not auto-hyphenate contenteditable */
  }

  .module-item:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .module-item.just-added {
    animation: module-glow 1.5s ease-out;
  }

  @keyframes module-glow {
    0% { box-shadow: 0 0 0 3px rgba(59, 115, 230, 0.5); }
    100% { box-shadow: 0 0 0 0 rgba(59, 115, 230, 0); }
  }

  .add-module-row {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .add-module-btn {
    font-size: 0.8125rem;
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
    font-size: 0.875rem;
  }

  .picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.25);
  }

  .picker-floating {
    position: fixed;
    z-index: 1001;
    background: var(--color-bg, white);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
    padding: 8px;
    max-width: 360px;
  }
</style>
