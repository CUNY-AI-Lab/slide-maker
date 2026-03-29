<script lang="ts">
  let { data, editable = false } = $props<{
    data: {
      src?: string
      url?: string
      rawSource?: string
      config?: Record<string, unknown>
      width?: string
      height?: string
      alt?: string
    }
    editable?: boolean
  }>()

  const width = $derived(data.width || '100%')
  const height = $derived(data.height || '400px')
  const alt = $derived(data.alt || 'Interactive visualization')

  // Build iframe src: prefer rawSource with config injected, fallback to src/url
  let iframeSrc = $derived.by(() => {
    if (data.rawSource) {
      // If rawSource is a URL, use it directly (don't wrap in a blob)
      if (/^https?:\/\//i.test(data.rawSource)) return data.rawSource
      const blob = new Blob([data.rawSource], { type: 'text/html' })
      return URL.createObjectURL(blob)
    }
    const src = data.src || data.url || ''
    // Only allow http(s) and blob URLs to prevent javascript: and data: injection
    return /^(https?:\/\/|blob:)/i.test(src) ? src : ''
  })
</script>

<div class="artifact-card" style="width: {width};">
  {#if editable}
    <div class="artifact-header">
      <span class="artifact-label">{alt}</span>
    </div>
  {/if}
  {#if iframeSrc}
    <iframe
      src={iframeSrc}
      class="artifact-iframe"
      class:no-interact={editable}
      style="height: {height};"
      sandbox="allow-scripts allow-same-origin"
      title={alt}
    ></iframe>
  {:else}
    <div class="artifact-placeholder">
      <span class="artifact-icon">?</span>
      <p>No artifact source configured</p>
    </div>
  {/if}
</div>

<style>
  .artifact-card {
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    border-radius: 4px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.02);
  }
  .artifact-header {
    display: flex;
    align-items: center;
    padding: 3px 8px;
    background: rgba(0, 0, 0, 0.04);
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    min-height: 20px;
  }
  .artifact-label {
    font-size: 9px;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .artifact-iframe {
    display: block;
    border: none;
    width: 100%;
  }
  .artifact-iframe.no-interact {
    pointer-events: none;
  }
  .artifact-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.9rem;
  }
  .artifact-icon {
    font-size: 2rem;
    margin-bottom: 8px;
  }
</style>
