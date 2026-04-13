<script lang="ts">
  import { API_URL } from '$lib/api'

  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let rawSrc = $derived(typeof data.src === 'string' ? data.src : typeof data.url === 'string' ? data.url : '')
  // Prepend API URL for relative paths (uploaded files served from API server)
  let src = $derived(rawSrc.startsWith('/api/') ? `${API_URL}${rawSrc}` : rawSrc)
  let alt = $derived(typeof data.alt === 'string' ? data.alt : '')
  let caption = $derived(typeof data.caption === 'string' ? data.caption : '')
  let imgWidth = $derived(typeof data.width === 'string' ? data.width : undefined)
  let imgHeight = $derived(typeof data.height === 'string' ? data.height : undefined)
</script>

<figure class="image-block">
  {#if src}
    <img {src} {alt} draggable="false" style:width={imgWidth} style:max-height={imgHeight ?? '60vh'} />
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
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: 6px;
    display: block;
    margin: 0 auto;
  }
  figcaption {
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--text-muted, rgba(240, 240, 240, 0.65));
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
