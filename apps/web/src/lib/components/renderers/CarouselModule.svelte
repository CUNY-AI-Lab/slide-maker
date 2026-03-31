<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let syncSteps = $derived(!!data.syncSteps)

  function toggleSyncSteps() {
    onchange?.({ ...data, syncSteps: !syncSteps })
  }

  let items: Array<{ src: string; caption?: string }> = $derived(
    Array.isArray(data.items)
      ? data.items.map((item: unknown) => {
          const i = item as Record<string, unknown>
          return {
            src: typeof i.src === 'string' ? i.src : '',
            caption: typeof i.caption === 'string' ? i.caption : undefined,
          }
        })
      : []
  )

  let activeIndex = $state(0)

  // Clamp active index when items change
  $effect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      activeIndex = items.length - 1
    }
  })

  function goTo(index: number) {
    activeIndex = index
  }

  function prev() {
    if (items.length === 0) return
    activeIndex = (activeIndex - 1 + items.length) % items.length
  }

  function next() {
    if (items.length === 0) return
    activeIndex = (activeIndex + 1) % items.length
  }
</script>

<div class="carousel">
  {#if items.length === 0}
    <div class="placeholder">No images in carousel</div>
  {:else}
    <div class="carousel-viewport">
      {#if items.length > 1}
        <button class="carousel-nav carousel-prev" onclick={prev} aria-label="Previous">&lsaquo;</button>
      {/if}
      <figure class="carousel-slide">
        <img src={items[activeIndex].src} alt={items[activeIndex].caption ?? `Slide ${activeIndex + 1}`} />
        {#if items[activeIndex].caption}
          <figcaption>{items[activeIndex].caption}</figcaption>
        {/if}
      </figure>
      {#if items.length > 1}
        <button class="carousel-nav carousel-next" onclick={next} aria-label="Next">&rsaquo;</button>
      {/if}
    </div>
    {#if items.length > 1}
      <div class="carousel-dots">
        {#each items as _, i}
          <button
            class="dot"
            class:active={i === activeIndex}
            onclick={() => goTo(i)}
            aria-label="Go to slide {i + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if editable}
    <label class="sync-steps-toggle">
      <input type="checkbox" checked={syncSteps} onchange={toggleSyncSteps} />
      <span>Sync with steps</span>
    </label>
  {/if}
</div>

<style>
  .carousel {
    width: 100%;
    position: relative;
  }
  .carousel-viewport {
    position: relative;
    display: flex;
    align-items: center;
  }
  .carousel-slide {
    margin: 0;
    text-align: center;
    width: 100%;
    flex: 1;
  }
  .carousel-slide img {
    width: 100%;
    max-height: 55cqi;
    object-fit: contain;
    border-radius: 6px;
    display: block;
    margin: 0 auto;
  }
  .carousel-slide figcaption {
    font-size: clamp(0.7rem, 1cqi, 0.85rem);
    color: var(--color-text-secondary);
    text-align: center;
    margin-top: 0.5rem;
    font-style: italic;
    font-family: var(--font-body);
  }
  .carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.4);
    color: white;
    border: none;
    width: clamp(1.5rem, 3cqi, 2.5rem);
    height: clamp(1.5rem, 3cqi, 2.5rem);
    border-radius: 50%;
    font-size: clamp(1rem, 2cqi, 1.5rem);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: background 0.15s;
  }
  .carousel-nav:hover {
    background: rgba(0, 0, 0, 0.6);
  }
  .carousel-prev { left: 0.5rem; }
  .carousel-next { right: 0.5rem; }
  .carousel-dots {
    display: flex;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s;
  }
  .dot.active {
    background: var(--teal, #2FB8D6);
  }
  .sync-steps-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.65rem;
    color: var(--color-text-muted, #6b7280);
    cursor: pointer;
    margin-top: 0.5rem;
    user-select: none;
  }
  .sync-steps-toggle input {
    width: 12px;
    height: 12px;
    cursor: pointer;
  }
  .placeholder {
    background: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: 6px;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
</style>
