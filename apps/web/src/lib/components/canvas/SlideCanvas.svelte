<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import CanvasToolbar from './CanvasToolbar.svelte'
  import FormatToolbar from './FormatToolbar.svelte'
  import SlideRenderer from './SlideRenderer.svelte'
  import type { Editor } from '@tiptap/core'

  let { editable = true }: { editable?: boolean } = $props()

  let activeSlide = $derived(
    $currentDeck?.slides.find((s) => s.id === $activeSlideId) ?? null
  )

  // Track the active TipTap editor for the format toolbar
  let activeEditor: Editor | null = $state(null)

  function handleEditorReady(editor: unknown) {
    activeEditor = editor as Editor
  }

  function handleEditorBlur() {
    // Small delay so toolbar clicks still work
    setTimeout(() => { activeEditor = null }, 300)
  }
</script>

<div class="slide-canvas">
  <CanvasToolbar />
  {#if editable}
    <FormatToolbar editor={activeEditor} />
  {/if}
  <div class="canvas-area">
    {#if activeSlide}
      <div class="slide-frame">
        <SlideRenderer slide={activeSlide} {editable} onEditorReady={handleEditorReady} />
      </div>
    {:else}
      <div class="no-slide">No slide selected</div>
    {/if}
  </div>
</div>

<style>
  .slide-canvas {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }
  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: auto;
  }
  .slide-frame {
    width: 100%;
    max-width: 720px;
    aspect-ratio: 16 / 9;
    background: white;
    border-radius: var(--radius-md);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }
  .no-slide {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }
</style>
