<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let src = $derived(typeof data.src === 'string' ? data.src : '')
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
  }
  img {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius-md);
    display: block;
    margin: 0 auto;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 0.5rem;
    font-style: italic;
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
