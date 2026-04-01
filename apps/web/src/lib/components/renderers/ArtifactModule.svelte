<script lang="ts">
  import { onMount } from 'svelte'
  import { base } from '$app/paths'
  import { getArtifact, type ArtifactController } from '$lib/modules/artifacts'
  import { buildSourceWithConfig } from '$lib/utils/artifact-config'
  // Register all built-in artifact factories
  import '$lib/modules/artifacts/astar'
  import '$lib/modules/artifacts/boids'
  import '$lib/modules/artifacts/flow'
  import '$lib/modules/artifacts/harmonograph'
  import '$lib/modules/artifacts/langton'
  import '$lib/modules/artifacts/lorenz'
  import '$lib/modules/artifacts/molnar'
  import '$lib/modules/artifacts/nake'
  import '$lib/modules/artifacts/rossler'
  import '$lib/modules/artifacts/sprott'
  import '$lib/modules/artifacts/tenprint'
  import '$lib/modules/artifacts/truchet'

  let { data, editable = false } = $props<{
    data: {
      artifactName?: string
      src?: string
      url?: string
      rawSource?: string
      config?: Record<string, unknown>
      width?: string
      height?: string
      alt?: string
      align?: 'left' | 'center' | 'right'
      autoSize?: boolean
      aspectRatio?: number
    }
    editable?: boolean
  }>()

  const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' \'unsafe-inline\' blob: data:; script-src \'unsafe-inline\'; img-src https: data: blob:; style-src \'unsafe-inline\'; connect-src \'none\'; frame-src \'none\';">'

  const width = $derived(data.width || '100%')
  const height = $derived(data.height || '')
  const hasCustomSize = $derived(!!data.width || !!data.height)
  const ratio = $derived.by(() => {
    const r = Number(data.aspectRatio)
    return isFinite(r) && r > 0 ? r : 16 / 9
  })
  const autoSize = $derived(data.autoSize !== false)
  const alt = $derived(data.alt || 'Interactive visualization')
  const align = $derived((data.align as string) || 'center')

  // Resolve factory: try artifactName first, then fall back to alt (legacy blocks)
  const factory = $derived(getArtifact(data.artifactName) ?? getArtifact(data.alt))
  const useNative = $derived(!!factory)

  // --- Native rendering state ---
  let container: HTMLDivElement | null = null
  let wrapper: HTMLDivElement | null = null
  let controller: ArtifactController | null = null
  let error = $state<string | null>(null)
  let mounted = false

  function startNative() {
    cleanupNative()
    error = null
    if (!factory || !container) return
    try {
      controller = factory(container, data.config ?? {})
    } catch (e) {
      console.error('Artifact init failed:', e)
      error = 'Failed to initialize artifact'
    }
  }

  function cleanupNative() {
    try { controller?.destroy?.() } catch {}
    controller = null
    if (container) container.replaceChildren()
  }

  onMount(() => {
    if (useNative) startNative()
    setupAutoSize()
    mounted = true
    return () => { mounted = false; cleanupNative(); ro?.disconnect(); ro = null }
  })

  $effect(() => {
    // Restart native renderer when artifact type changes (skip initial mount — onMount handles it)
    if (!mounted || !useNative) return
    data.artifactName; data.alt
    startNative()
  })

  $effect(() => {
    // Propagate config updates to native controller
    if (controller) controller.update?.(data.config ?? {})
  })

  // --- Iframe fallback (legacy HTML-source artifacts) ---
  const iframe = $derived.by(() => {
    if (useNative) return { src: '', srcdoc: '' }
    if (data.rawSource) {
      if (/^https?:\/\//i.test(data.rawSource)) return { src: data.rawSource, srcdoc: '' }
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
      const b64 = btoa(unescape(encodeURIComponent(html)))
      return { src: `${base}/artifact?b64=${encodeURIComponent(b64)}`, srcdoc: '' }
    }
    const src = data.src || data.url || ''
    const safe = /^(https?:\/\/|blob:)/i.test(src) ? src : ''
    return { src: safe, srcdoc: '' }
  })

  $effect(() => {
    if (!useNative) {
      const url = iframe.src
      return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url) }
    }
  })

  // --- Auto-size: compute height to fit canvas zone ---
  let ro: ResizeObserver | null = null
  let computedHeight = $state<number | null>(null)
  function computeAutoHeight() {
    if (!wrapper) return
    if (!autoSize) { computedHeight = null; return }
    // Measure available width/height from nearest zone container
    const zone = wrapper.closest('.zone-left, .zone-right, .zone-main, .zone-centered') as HTMLElement | null
    const containerEl = zone ?? wrapper.parentElement
    const zoneRect = containerEl?.getBoundingClientRect()
    const wrapRect = wrapper.getBoundingClientRect()
    if (!zoneRect || !wrapRect) return
    const availH = Math.max(120, zoneRect.height - 24) // leave some breathing room
    const availW = Math.max(1, wrapRect.width)
    const ideal = availW / ratio
    const next = Math.floor(Math.min(ideal, availH))
    if (!Number.isFinite(next) || next <= 0) return
    computedHeight = next
  }
  function setupAutoSize() {
    if (ro) ro.disconnect()
    if (!wrapper) return
    ro = new ResizeObserver(() => computeAutoHeight())
    ro.observe(wrapper)
    const zone = wrapper.closest('.zone-left, .zone-right, .zone-main, .zone-centered') as HTMLElement | null
    if (zone) ro.observe(zone)
    computeAutoHeight()
  }
  $effect(() => { autoSize; ratio; setupAutoSize() })
</script>

<div
  class="artifact-wrapper"
  class:custom-sized={hasCustomSize}
  class:auto-size={autoSize}
  bind:this={wrapper}
  style="width: {width};{autoSize && computedHeight ? ` height: ${computedHeight}px;` : hasCustomSize && height ? ` height: ${height};` : ''} {align === 'left' ? 'margin-right: auto;' : align === 'right' ? 'margin-left: auto;' : 'margin: 0 auto;'}"
>
  {#if editable}
    <div class="artifact-header">
      <span class="artifact-label">{alt}</span>
    </div>
  {/if}

  {#if useNative}
    {#if error}
      <div class="artifact-placeholder">
        <span class="artifact-icon">!</span>
        <p>{error}</p>
      </div>
    {:else}
      <div bind:this={container} class="artifact-native" class:no-interact={editable}></div>
    {/if}
  {:else if iframe.src}
    <iframe
      src={iframe.src}
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
  .artifact-native,
  .artifact-iframe {
    display: block;
    border: none;
    width: 100%;
    flex: 1;
    min-height: 0;
    aspect-ratio: 1;
  }
  .artifact-wrapper.custom-sized .artifact-native,
  .artifact-wrapper.custom-sized .artifact-iframe { aspect-ratio: auto; }
  .artifact-wrapper.auto-size .artifact-native,
  .artifact-wrapper.auto-size .artifact-iframe { aspect-ratio: auto; height: 100%; }
  .artifact-native.no-interact,
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
