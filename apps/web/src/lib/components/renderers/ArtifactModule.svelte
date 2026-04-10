<script lang="ts">
  import {
    ARTIFACT_RENDER_EVENT,
    DEFAULT_ARTIFACT_RENDER_TIMEOUT_MS,
    buildInlineArtifactSrcdoc,
  } from '@slide-maker/shared'
  import { onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { API_URL } from '$lib/api'
  import { buildSourceWithConfig } from '$lib/utils/artifact-config'
  import {
    clearModuleRenderStatus,
    markModuleRenderStatus,
    renderDiagnostics,
  } from '$lib/stores/render-diagnostics'

  type ArtifactFactoryLike = {
    kind?: string
    key?: string
  }

  let { data, moduleId, slideId, editable = false, onchange, editTrigger = 0 } = $props<{
    data: {
      registryId?: string
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
      factory?: ArtifactFactoryLike | null
    }
    moduleId: string
    slideId: string
    editable?: boolean
    onchange?: (newData: Record<string, unknown>) => void
    editTrigger?: number
  }>()

  let lastTrigger = 0
  $effect(() => {
    if (editTrigger > lastTrigger) {
      lastTrigger = editTrigger
      openEditor()
    }
  })

  const width = $derived(data.width || '100%')
  const explicitHeight = $derived(data.height || '')
  const hasCustomSize = $derived(!!data.width || !!data.height)
  const ratio = $derived.by(() => {
    const value = Number(data.aspectRatio)
    return Number.isFinite(value) && value > 0 ? value : 16 / 9
  })
  const autoSize = $derived(data.autoSize !== false)
  const alt = $derived(data.alt || 'Interactive visualization')
  const align = $derived((data.align as string) || 'center')

  function configAttrName(): string {
    if (data.factory && typeof data.factory === 'object' && typeof data.factory.key === 'string') {
      return data.factory.key
    }
    return 'data-config'
  }

  let inlineSource = $derived.by(() => {
    const rawSource = typeof data.rawSource === 'string' ? data.rawSource : ''
    if (!rawSource || /^https?:\/\//i.test(rawSource)) return ''
    if (data.config && Object.keys(data.config).length > 0) {
      return buildSourceWithConfig(rawSource, data.config, configAttrName())
    }
    return rawSource
  })

  let useSrcdoc = $derived(!!inlineSource)
  let srcdocContent = $derived(
    inlineSource
      ? buildInlineArtifactSrcdoc(inlineSource, {
          apiUrl: API_URL,
          moduleId,
          slideId,
          surface: 'edit',
        })
      : '',
  )
  let iframeSrc = $derived.by(() => {
    if (data.rawSource && /^https?:\/\//i.test(data.rawSource)) return data.rawSource
    const src = data.src || data.url || ''
    if (/^(https?:\/\/|blob:)/i.test(src)) return src
    if (src.startsWith('/api/')) return `${API_URL}${src}`
    return ''
  })
  let hasRenderableSource = $derived(useSrcdoc || !!iframeSrc)
  let diagnostic = $derived($renderDiagnostics[moduleId] ?? null)

  let renderTimeout: ReturnType<typeof setTimeout> | null = null
  let wrapper: HTMLDivElement | null = $state(null)
  let resizeObserver: ResizeObserver | null = null
  let computedHeight: number | null = $state(null)

  function clearRenderTimer() {
    if (renderTimeout) {
      clearTimeout(renderTimeout)
      renderTimeout = null
    }
  }

  function clearResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  function startRenderTracking() {
    clearRenderTimer()
    if (!hasRenderableSource) {
      clearModuleRenderStatus(moduleId)
      return
    }

    markModuleRenderStatus({
      moduleId,
      slideId,
      surface: 'edit',
      status: 'loading',
    })

    renderTimeout = setTimeout(() => {
      const latest = get(renderDiagnostics)[moduleId]
      if (!latest || latest.surface !== 'edit' || latest.status === 'ready') return
      markModuleRenderStatus({
        moduleId,
        slideId,
        surface: 'edit',
        status: 'error',
        message: 'Artifact timed out while rendering on the canvas',
      })
    }, DEFAULT_ARTIFACT_RENDER_TIMEOUT_MS)
  }

  function handleSrcdocLoad() {
    clearRenderTimer()
    const latest = get(renderDiagnostics)[moduleId]
    if (!latest || latest.status === 'loading') {
      markModuleRenderStatus({
        moduleId,
        slideId,
        surface: 'edit',
        status: 'ready',
      })
    }
  }

  function handleIframeLoad() {
    if (!iframeSrc) return
    clearRenderTimer()
    markModuleRenderStatus({
      moduleId,
      slideId,
      surface: 'edit',
      status: 'ready',
    })
  }

  function handleIframeError() {
    clearRenderTimer()
    markModuleRenderStatus({
      moduleId,
      slideId,
      surface: 'edit',
      status: 'error',
      message: 'Artifact iframe failed to load',
    })
  }

  function handleArtifactMessage(event: MessageEvent) {
    // Validate origin: accept only same-origin or 'null' (srcdoc iframes)
    if (event.origin !== 'null' && event.origin !== window.location.origin) return
    const payload = event.data
    if (!payload || typeof payload !== 'object') return
    if ((payload as { type?: string }).type !== ARTIFACT_RENDER_EVENT) return
    if ((payload as { moduleId?: string }).moduleId !== moduleId) return
    if ((payload as { slideId?: string }).slideId !== slideId) return
    if ((payload as { surface?: string }).surface !== 'edit') return

    const status =
      (payload as { status?: string }).status === 'error'
        ? 'error'
        : (payload as { status?: string }).status === 'ready'
          ? 'ready'
          : 'loading'

    clearRenderTimer()
    markModuleRenderStatus({
      moduleId,
      slideId,
      surface: 'edit',
      status,
      message:
        typeof (payload as { message?: unknown }).message === 'string'
          ? (payload as { message: string }).message
          : undefined,
    })
  }

  function computeAutoHeight() {
    if (!wrapper) return
    if (!autoSize) {
      computedHeight = null
      return
    }

    const zone = wrapper.closest(
      '.zone-left, .zone-right, .zone-main, .zone-centered, .zone-stage, .zone-hero, .zone-content, .zone-primary',
    ) as HTMLElement | null
    const container = zone ?? wrapper.parentElement
    const zoneRect = container?.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    if (!zoneRect || !wrapperRect.width) return

    const availableHeight = Math.max(120, zoneRect.height - (editable ? 32 : 16))
    const availableWidth = Math.max(1, wrapperRect.width)
    const nextHeight = Math.floor(Math.min(availableWidth / ratio, availableHeight))
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return
    computedHeight = nextHeight
  }

  function setupAutoSize() {
    clearResizeObserver()
    if (!wrapper) return

    resizeObserver = new ResizeObserver(() => computeAutoHeight())
    resizeObserver.observe(wrapper)

    const zone = wrapper.closest(
      '.zone-left, .zone-right, .zone-main, .zone-centered, .zone-stage, .zone-hero, .zone-content, .zone-primary',
    ) as HTMLElement | null
    if (zone) resizeObserver.observe(zone)

    computeAutoHeight()
  }

  $effect(() => {
    void wrapper
    void autoSize
    void ratio
    setupAutoSize()
    return clearResizeObserver
  })

  $effect(() => {
    void srcdocContent
    void iframeSrc
    void useSrcdoc
    void hasRenderableSource
    startRenderTracking()
    return clearRenderTimer
  })

  $effect(() => {
    if (diagnostic?.surface === 'edit' && diagnostic.status !== 'loading') {
      clearRenderTimer()
    }
  })

  $effect(() => {
    window.addEventListener('message', handleArtifactMessage)
    return () => window.removeEventListener('message', handleArtifactMessage)
  })

  onDestroy(() => {
    clearRenderTimer()
    clearResizeObserver()
  })

  let showEditor = $state(false)
  let editorMode = $state<'data' | 'source'>('data')
  let editorContent = $state('')
  let dataEntries = $state<{ lat: string; lng: string; label: string; value: string }[]>([])

  function extractMarkers(html: string): { lat: string; lng: string; label: string; value: string }[] {
    const match = html.match(/markers\s*=\s*\[([^\]]+)\]/)
    if (!match) return []
    try {
      const cleaned = `[${match[1].replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"')}]`
      const parsed = JSON.parse(cleaned)
      return parsed.map((marker: any) => ({
        lat: String(marker.lat ?? ''),
        lng: String(marker.lng ?? ''),
        label: String(marker.label ?? ''),
        value: String(marker.value ?? ''),
      }))
    } catch {
      return []
    }
  }

  function injectMarkers(
    html: string,
    markers: { lat: string; lng: string; label: string; value: string }[],
  ): string {
    const jsArray = markers
      .filter((marker) => marker.lat && marker.lng && marker.label)
      .map(
        (marker) =>
          `{lat:${marker.lat},lng:${marker.lng},label:'${marker.label.replace(/'/g, "\\'")}',value:'${(marker.value || '').replace(/'/g, "\\'")}'}`,
      )
      .join(',')
    return html.replace(/markers\s*=\s*\[[^\]]*\]/, `markers=[${jsArray}]`)
  }

  function openEditor() {
    editorContent = data.rawSource ?? ''
    const extracted = extractMarkers(editorContent)
    if (extracted.length > 0) {
      dataEntries = extracted
      editorMode = 'data'
    } else {
      editorMode = 'source'
    }
    showEditor = true
  }

  function addEntry() {
    dataEntries = [...dataEntries, { lat: '', lng: '', label: '', value: '' }]
  }

  function removeEntry(index: number) {
    dataEntries = dataEntries.filter((_, current) => current !== index)
  }

  function saveEditor() {
    if (editorMode === 'data' && dataEntries.length > 0) {
      onchange?.({
        ...data,
        rawSource: injectMarkers(data.rawSource ?? editorContent, dataEntries),
      })
    } else {
      onchange?.({ ...data, rawSource: editorContent })
    }
    showEditor = false
  }

  function closeEditor() {
    showEditor = false
  }
</script>

<div
  class="artifact-wrapper"
  class:custom-sized={hasCustomSize}
  class:auto-size={autoSize}
  bind:this={wrapper}
  style="width: {width};{autoSize && computedHeight ? ` height: ${computedHeight}px;` : hasCustomSize && explicitHeight ? ` height: ${explicitHeight};` : ''} {align === 'left' ? 'margin-right: auto;' : align === 'right' ? 'margin-left: auto;' : 'margin: 0 auto;'}"
>
  {#if editable}
    <div class="artifact-header">
      <span class="artifact-label">{alt}</span>
    </div>
  {/if}

  {#if useSrcdoc}
    <iframe
      srcdoc={srcdocContent}
      class="artifact-iframe"
      class:no-interact={editable}
      sandbox="allow-scripts"
      title={alt}
      referrerpolicy="origin-when-cross-origin"
      onload={handleSrcdocLoad}
    ></iframe>
  {:else if iframeSrc}
    <iframe
      src={iframeSrc}
      class="artifact-iframe"
      class:no-interact={editable}
      sandbox="allow-scripts"
      title={alt}
      loading="lazy"
      referrerpolicy="origin-when-cross-origin"
      onload={handleIframeLoad}
      onerror={handleIframeError}
    ></iframe>
  {:else}
    <div class="artifact-placeholder">
      <span class="artifact-icon">?</span>
      <p>No artifact source configured</p>
      {#if editable}
        <button class="edit-data-btn" onclick={openEditor} type="button">Add Source</button>
      {/if}
    </div>
  {/if}

  {#if diagnostic?.surface === 'edit' && diagnostic.status === 'loading'}
    <div class="artifact-status loading">Rendering artifact…</div>
  {:else if diagnostic?.surface === 'edit' && diagnostic.status === 'error'}
    <div class="artifact-status error">
      <strong>Render failed</strong>
      <span>{diagnostic.message || 'The artifact did not finish rendering on the canvas.'}</span>
    </div>
  {/if}
</div>

{#if showEditor}
  <div class="editor-overlay" role="button" tabindex="0" onclick={(event) => { if (event.target === event.currentTarget) closeEditor() }} onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && closeEditor()}>
    <div class="editor-dialog" role="dialog" aria-modal="true" tabindex="-1">
      <div class="editor-header">
        <h3>Edit Artifact</h3>
        <div class="editor-tabs">
          <button class:active={editorMode === 'data'} onclick={() => (editorMode = 'data')} type="button">Data</button>
          <button class:active={editorMode === 'source'} onclick={() => (editorMode = 'source')} type="button">Source</button>
        </div>
        <button class="close-btn" onclick={closeEditor} type="button">&times;</button>
      </div>

      {#if editorMode === 'data' && dataEntries.length > 0}
        <div class="data-editor">
          <div class="data-header-row">
            <span class="col-label">Label</span>
            <span class="col-lat">Lat</span>
            <span class="col-lng">Lng</span>
            <span class="col-value">Value</span>
            <span class="col-action"></span>
          </div>
          {#each dataEntries as entry, index}
            <div class="data-row">
              <input class="col-label" bind:value={entry.label} placeholder="Name" />
              <input class="col-lat" bind:value={entry.lat} placeholder="Lat" type="number" step="any" />
              <input class="col-lng" bind:value={entry.lng} placeholder="Lng" type="number" step="any" />
              <input class="col-value" bind:value={entry.value} placeholder="Info" />
              <button class="remove-row" onclick={() => removeEntry(index)} type="button">&times;</button>
            </div>
          {/each}
          <button class="add-row-btn" onclick={addEntry} type="button">+ Add Point</button>
        </div>
      {:else}
        <textarea
          class="source-editor"
          bind:value={editorContent}
          spellcheck="false"
          placeholder="Paste full HTML source here..."
        ></textarea>
      {/if}

      <div class="editor-footer">
        <button class="cancel-btn" onclick={closeEditor} type="button">Cancel</button>
        <button class="save-btn" onclick={saveEditor} type="button">Save & Reload</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .artifact-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--theme-border, rgba(17, 24, 39, 0.12));
    border-radius: 8px;
    overflow: visible;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    position: relative;
  }
  .artifact-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255,255,255,0.03)) 50%, transparent);
    border-bottom: 1px solid var(--theme-border, rgba(17, 24, 39, 0.12));
    min-height: 22px;
  }
  .artifact-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--theme-secondary-label, #6b7280);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: none;
    letter-spacing: 0.2px;
  }
  .edit-data-btn {
    font-size: 10px;
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 4px;
    color: var(--color-primary, #3b82f6);
    cursor: pointer;
    font-family: var(--font-body);
    transition: background 0.15s;
  }
  .edit-data-btn:hover {
    background: rgba(59, 130, 246, 0.08);
  }
  .artifact-iframe {
    display: block;
    border: none;
    width: 100%;
    flex: 1;
    min-height: 0;
    aspect-ratio: 16 / 9;
  }
  .artifact-wrapper.custom-sized .artifact-iframe {
    aspect-ratio: auto;
  }
  .artifact-wrapper.auto-size .artifact-iframe {
    aspect-ratio: auto;
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
    background: var(--theme-card-bg, rgba(255,255,255,0.03));
    border: 1px dashed var(--theme-border, rgba(17,24,39,0.12));
    color: var(--theme-text-muted, rgba(240,240,240,0.65));
    font-size: 0.9rem;
    gap: 8px;
  }
  .artifact-icon {
    font-size: 2rem;
  }
  .editor-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .editor-dialog {
    background: var(--color-bg, white);
    border-radius: 8px;
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  }
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  .editor-header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--color-text-secondary);
  }
  .source-editor {
    flex: 1;
    min-height: 300px;
    padding: 1rem;
    border: none;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: none;
    outline: none;
    background: var(--color-bg);
    color: var(--color-text);
  }
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-border);
  }
  .cancel-btn {
    padding: 0.4rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--color-text-secondary);
  }
  .save-btn {
    padding: 0.4rem 1rem;
    background: var(--color-primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .save-btn:hover {
    opacity: 0.9;
  }
  .editor-tabs {
    display: flex;
    gap: 2px;
  }
  .editor-tabs button {
    padding: 4px 12px;
    font-size: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }
  .editor-tabs button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  .data-editor {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem;
  }
  .data-header-row {
    display: flex;
    gap: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .data-row {
    display: flex;
    gap: 4px;
    margin-bottom: 3px;
  }
  .data-row input {
    padding: 4px 6px;
    font-size: 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    outline: none;
    font-family: var(--font-body);
  }
  .data-row input:focus {
    border-color: var(--color-primary);
  }
  .col-label {
    flex: 2;
    min-width: 0;
  }
  .col-lat,
  .col-lng {
    flex: 1;
    min-width: 0;
  }
  .col-value {
    flex: 1.5;
    min-width: 0;
  }
  .col-action {
    width: 24px;
    flex-shrink: 0;
  }
  .remove-row {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .remove-row:hover {
    color: var(--color-error, #dc2626);
  }
  .add-row-btn {
    margin-top: 6px;
    padding: 4px 12px;
    font-size: 0.75rem;
    background: transparent;
    border: 1px dashed var(--color-border);
    border-radius: 4px;
    color: var(--color-primary);
    cursor: pointer;
  }
  .add-row-btn:hover {
    background: rgba(59, 130, 246, 0.05);
  }
  .artifact-status {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.35;
    backdrop-filter: saturate(140%) blur(6px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(17, 24, 39, 0.18);
    background: rgba(255, 255, 255, 0.92);
    color: #111827;
  }
  .artifact-status.loading strong { color: #374151; }
  .artifact-status.error {
    border-color: color-mix(in srgb, var(--color-error, #dc2626) 35%, rgba(17,24,39,0.18));
    box-shadow: 0 8px 20px color-mix(in srgb, var(--color-error, #dc2626) 25%, transparent);
  }
  .artifact-status.error strong { color: var(--color-error, #dc2626); }
  .artifact-status strong {
    font-size: 10px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
</style>
