<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let src = $derived(typeof data.src === 'string' ? data.src : '')
  let title = $derived(typeof data.title === 'string' ? data.title : '')
  let height = $derived(typeof data.height === 'number' ? data.height : 300)
</script>

<div class="embed-block">
  {#if title}
    <div class="embed-title">{title}</div>
  {/if}
  {#if src}
    <div class="embed-frame" style="height: {height}px;">
      <iframe
        {src}
        {title}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        frameborder="0"
      ></iframe>
    </div>
  {:else}
    <div class="embed-placeholder">No embed source provided</div>
  {/if}
</div>

<style>
  .embed-block {
    width: 100%;
  }
  .embed-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }
  .embed-frame {
    width: 100%;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  .embed-placeholder {
    background: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
</style>
