<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import CanvasToolbar from './CanvasToolbar.svelte'
  import SlideRenderer from './SlideRenderer.svelte'

  let activeSlide = $derived(
    $currentDeck?.slides.find((s) => s.id === $activeSlideId) ?? null
  )
</script>

<div class="slide-canvas">
  <CanvasToolbar />
  <div class="canvas-area">
    {#if activeSlide}
      <div class="slide-frame">
        <SlideRenderer slide={activeSlide} editable={true} />
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
