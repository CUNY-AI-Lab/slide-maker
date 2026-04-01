<script lang="ts">
  import { untrack } from 'svelte'
  import { base } from '$app/paths'
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

  const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' \'unsafe-inline\' blob: data:; script-src \'unsafe-inline\'; img-src https: data: blob:; style-src \'unsafe-inline\'; connect-src \'none\'; frame-src \'none\';">'

  const width = $derived(data.width || '100%')
  const height = $derived(data.height || '')
  const hasCustomSize = $derived(!!data.width || !!data.height)
  const alt = $derived(data.alt || 'Interactive visualization')
  const align = $derived((data.align as string) || 'center')

  // Prefer srcdoc for inline HTML to preserve a valid referrer for subresources (e.g., OSM tiles)
  // Build iframe params: { src, srcdoc }
  const iframe = $derived.by(() => {
    if (data.rawSource) {
      // If rawSource looks like an absolute URL, use it directly via src
      if (/^https?:\/\//i.test(data.rawSource)) return { src: data.rawSource, srcdoc: '' }
      // Otherwise, treat as inline HTML and inject config + CSP, served via srcdoc
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
      // Serve via same-origin endpoint so subresources (e.g., OSM tiles) get a proper Referer
      // Base64-encode to pass safely in the query string
      const b64 = btoa(unescape(encodeURIComponent(html)))
      return { src: `${base}/artifact?b64=${encodeURIComponent(b64)}`, srcdoc: '' }
    }
    const src = data.src || data.url || ''
    // Only allow http(s) and blob URLs to prevent javascript: and data: injection
    const safe = /^(https?:\/\/|blob:)/i.test(src) ? src : ''
    return { src: safe, srcdoc: '' }
  })

  // Revoke blob URLs on cleanup
  $effect(() => {
    const url = iframe.src
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })
</script>

<div
  class="artifact-wrapper"
  class:custom-sized={hasCustomSize}
  style="width: {width};{hasCustomSize && height ? ` height: ${height};` : ''} {align === 'left' ? 'margin-right: auto;' : align === 'right' ? 'margin-left: auto;' : 'margin: 0 auto;'}"
>
  {#if editable}
    <div class="artifact-header">
      <span class="artifact-label">{alt}</span>
    </div>
  {/if}
  {#if iframe.src || iframe.srcdoc}
    <iframe
      src={iframe.src || undefined}
      srcdoc={iframe.srcdoc || undefined}
      class="artifact-iframe"
      class:no-interact={editable}
      sandbox="allow-scripts"
      title={alt}
      loading="lazy"
      referrerpolicy="origin-when-cross-origin"
    ></iframe>
  {:else}
    <div class="artifact-placeholder">
      <span class="artifact-icon">?</span>
      <p>No artifact source configured</p>
    </div>
  {/if}
</div>

<style>
  /* Align editor styling with export/preview framework CSS */
  .artifact-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
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
    flex: 1;
    min-height: 0;
    /* Default to 16:9 aspect */
    aspect-ratio: 16 / 9;
  }
  /* When an explicit height is provided on the wrapper, drop square aspect */
  .artifact-wrapper.custom-sized .artifact-iframe { aspect-ratio: auto; }
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
