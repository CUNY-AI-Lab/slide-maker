<script lang="ts">
  import { untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import { dragHandleZone, TRIGGERS } from 'svelte-dnd-action'
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
    onModuleResize,
    onModuleDelete,
    onModuleStepChange,
    onMoveToZone,
    onEditorReady,
  }: {
    modules: Module[]
    zone: string
    editable?: boolean
    deckId?: string
    slideId?: string
    onReorder?: (zone: string, items: Module[]) => void
    onModuleDataChange?: (moduleId: string, data: Record<string, unknown>) => void
    onModuleResize?: (moduleId: string, data: Record<string, unknown>) => void
    onModuleDelete?: (moduleId: string) => void
    onModuleStepChange?: (moduleId: string, stepOrder: number | null) => void
    onMoveToZone?: (blockId: string, fromZone: string, toZone: string, newOrder: string[]) => void
    onEditorReady?: (editor: unknown) => void
  } = $props()

  let items = $state<Module[]>([])
  let showPicker = $state(false)
  let pickerX = $state(0)
  let pickerY = $state(0)
  let highlightedIds = $state<Set<string>>(new Set())
  let knownIds: Set<string> = new Set()

  // Guard to prevent store sync during drag — plain boolean, NOT $state
  let dragging = false

  const flipDurationMs = 200

  $effect(() => {
    const mods = modules.map((m) => ({ ...m }))
    if (untrack(() => !dragging)) {
      items = mods

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
    }
  })

  function handleConsider(e: CustomEvent<{ items: Module[]; info: { trigger: string; id: string; source: string } }>) {
    dragging = true
    items = e.detail.items
  }

  async function handleFinalize(e: CustomEvent<{ items: Module[]; info: { trigger: string; id: string; source: string } }>) {
    const { info } = e.detail
    items = e.detail.items.map((m, i) => ({ ...m, order: i }))

    if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
      // This zone is the DESTINATION — check if item came from another zone
      const movedItem = e.detail.items.find(m => m.id === info.id)
      if (movedItem && movedItem.zone !== zone) {
        const fromZone = movedItem.zone
        items = items.map(m => m.id === info.id ? { ...m, zone } : m)
        await onMoveToZone?.(info.id, fromZone, zone, items.map(m => m.id))
      } else {
        // Same-zone reorder
        await onReorder?.(zone, items)
      }
    }
    // DROPPED_INTO_ANOTHER: source zone item was taken away.
    // No mutation needed — moveBlockToZone from the destination
    // already reindexes both source and destination zones.

    dragging = false
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

  function transformDragPreview(el: HTMLElement) {
    el.style.opacity = '0.9'
    el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
    el.style.borderRadius = '8px'
  }
</script>

<div class="zone-drop" class:editable aria-label="{zone} zone">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="zone-drop-list"
    use:dragHandleZone={{
      items,
      flipDurationMs,
      type: `canvas-zone-${slideId}`,
      dropFromOthersDisabled: false,
      dropTargetStyle: {},
      dropTargetClasses: ['zone-drop-active'],
      morphDisabled: true,
      centreDraggedOnCursor: true,
      transformDraggedElement: transformDragPreview,
    }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
  >
    {#each items as mod, i (mod.id)}
      <div class="module-item" class:just-added={highlightedIds.has(mod.id)} animate:flip={{ duration: flipDurationMs }}>
        <ModuleRenderer
          module={mod}
          {slideId}
          {editable}
          onchange={(newData) => onModuleDataChange?.(mod.id, newData)}
          onresize={(newData) => onModuleResize?.(mod.id, newData)}
          ondelete={() => onModuleDelete?.(mod.id)}
          onstepchange={(step) => onModuleStepChange?.(mod.id, step)}
          oneditorready={onEditorReady}
        />
      </div>
    {/each}
  </div>
  {#if editable && deckId && slideId}
    <div class="add-module-row">
      <button class="add-module-btn" class:empty-add={items.length === 0} onclick={(e) => { lastTrigger = e.currentTarget as HTMLElement; togglePicker(e) }} aria-haspopup="dialog" aria-expanded={showPicker}>+ Module</button>
    </div>
  {:else if items.length === 0}
    <div class="empty-hint">+ Add module</div>
  {/if}
</div>

{#if showPicker}
  <div class="picker-overlay" role="button" tabindex="0" onclick={() => showPicker = false} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showPicker = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-floating" role="dialog" aria-label="Add module" tabindex="-1" style="left: {pickerX}px; top: {pickerY}px;" onclick={(e) => e.stopPropagation()}>
      <ModulePicker {deckId} {slideId} {zone} onAdd={handleModuleAdded} />
    </div>
  </div>
{/if}

<style>
  .zone-drop {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 2rem;
    padding: 0;
    width: 100%;
    align-self: stretch;
    container-type: inline-size;
  }

  .zone-drop-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: manual;
    transition: background 0.15s ease;
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

  /* DnD shadow element (drop placeholder) */
  .zone-drop-list :global([data-is-dnd-shadow-item-internal]) {
    background: rgba(59, 115, 230, 0.08);
    border: 2px dashed rgba(59, 115, 230, 0.35);
    border-radius: 6px;
    opacity: 0.6;
    min-height: 40px;
  }

  /* Zone highlight when dragging over */
  :global(.zone-drop-active) {
    outline: 2px solid rgba(59, 115, 230, 0.25);
    outline-offset: 2px;
    border-radius: 8px;
    background: rgba(59, 115, 230, 0.03);
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
