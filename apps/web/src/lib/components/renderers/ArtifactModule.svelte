<script lang="ts">
  import { untrack } from 'svelte'
  import { buildSourceWithConfig } from '$lib/utils/artifact-config'

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

  const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' \'unsafe-inline\' blob: data:; script-src \'unsafe-inline\' \'unsafe-eval\'; connect-src \'none\'; frame-src \'none\';">'

  const width = $derived(data.width || '100%')
  const height = $derived(data.height || '100%')
  const alt = $derived(data.alt || 'Interactive visualization')

  // Build iframe src: prefer rawSource with CSP injected, fallback to src/url
  let iframeSrc = $derived.by(() => {
    if (data.rawSource) {
      // If rawSource is a URL, use it directly (don't wrap in a blob)
      if (/^https?:\/\//i.test(data.rawSource)) return data.rawSource
      // Inject config into source if present
      let html = data.config && Object.keys(data.config).length > 0
        ? buildSourceWithConfig(data.rawSource, data.config)
        : data.rawSource
      if (html.includes('<head>')) {
        html = html.replace('<head>', '<head>' + CSP_META)
      } else if (html.includes('<html>')) {
        html = html.replace('<html>', '<html><head>' + CSP_META + '</head>')
      } else {
        html = CSP_META + html
      }
      const blob = new Blob([html], { type: 'text/html' })
      return URL.createObjectURL(blob)
    }
    const src = data.src || data.url || ''
    // Only allow http(s) and blob URLs to prevent javascript: and data: injection
    return /^(https?:\/\/|blob:)/i.test(src) ? src : ''
  })

  // Revoke blob URLs on cleanup
  $effect(() => {
    const url = iframeSrc
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
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
      loading="lazy"
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
    aspect-ratio: 1;
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
    height: 100%;
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
