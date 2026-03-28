<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let src = $derived(typeof data.src === 'string' ? data.src : typeof data.url === 'string' ? data.url : '')
  let alt = $derived(typeof data.alt === 'string' ? data.alt : '')
  let caption = $derived(typeof data.caption === 'string' ? data.caption : '')
</script>

<figure class="image-block">
  {#if src}
    <img {src} {alt} />
  {:else}
    <div class="placeholder">No image source</div>
  {/if}
  {#if caption}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>

<style>
  .image-block {
    margin: 0;
    text-align: center;
    width: 100%;
  }
  img {
    width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: var(--radius-md);
    display: block;
    margin: 0 auto;
  }
  figcaption {
    font-size: clamp(0.7rem, 1vw, 0.85rem);
    color: var(--color-text-secondary);
    text-align: center;
    margin-top: 0.5rem;
    font-style: italic;
    font-family: var(--font-body);
  }
  .placeholder {
    background: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: 2rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
</style>
