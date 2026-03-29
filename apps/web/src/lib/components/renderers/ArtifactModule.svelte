<script lang="ts">
  let { data, editable = false, onchange } = $props<{
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
    onchange?: (newData: Record<string, unknown>) => void
  }>()

  const width = $derived(data.width || '100%')
  const height = $derived(data.height || '400px')
  const alt = $derived(data.alt || 'Interactive visualization')

  import { API_URL } from '$lib/api'

  // Resolve relative /api/ URLs to absolute for srcdoc contexts
  function resolveUrls(html: string): string {
    return html.replace(/(href|src)=(['"])\/api\//g, `$1=$2${API_URL}/api/`)
  }

  // Use srcdoc for rawSource (inherits parent origin for relative URLs), src for external
  let useSrcdoc = $derived(!!data.rawSource && !/^https?:\/\//i.test(data.rawSource))
  let srcdocContent = $derived(data.rawSource ? resolveUrls(data.rawSource) : '')
  let iframeSrc = $derived.by(() => {
    if (data.rawSource && /^https?:\/\//i.test(data.rawSource)) return data.rawSource
    if (data.rawSource) return '' // using srcdoc instead
    const src = data.src || data.url || ''
    return /^(https?:\/\/|blob:)/i.test(src) ? src : ''
  })

  // Edit mode — structured data editor + raw source fallback
  let showEditor = $state(false)
  let editorMode = $state<'data' | 'source'>('data')
  let editorContent = $state('')
  let dataEntries = $state<{ lat: string; lng: string; label: string; value: string }[]>([])

  // Try to extract markers from rawSource for structured editing
  function extractMarkers(html: string): { lat: string; lng: string; label: string; value: string }[] {
    // Match var markers=[...] or markers=[...]
    const match = html.match(/markers\s*=\s*\[([^\]]+)\]/)
    if (!match) return []
    try {
      // Clean up the JS array to valid JSON
      const cleaned = '[' + match[1].replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"') + ']'
      const arr = JSON.parse(cleaned)
      return arr.map((m: any) => ({
        lat: String(m.lat ?? ''),
        lng: String(m.lng ?? ''),
        label: String(m.label ?? ''),
        value: String(m.value ?? ''),
      }))
    } catch {
      return []
    }
  }

  // Inject markers back into rawSource
  function injectMarkers(html: string, markers: { lat: string; lng: string; label: string; value: string }[]): string {
    const jsArray = markers
      .filter(m => m.lat && m.lng && m.label)
      .map(m => `{lat:${m.lat},lng:${m.lng},label:'${m.label.replace(/'/g, "\\'")}',value:'${(m.value || '').replace(/'/g, "\\'")}'}`)
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

  function removeEntry(i: number) {
    dataEntries = dataEntries.filter((_, idx) => idx !== i)
  }

  function saveEditor() {
    if (editorMode === 'data' && dataEntries.length > 0) {
      const updated = injectMarkers(data.rawSource ?? editorContent, dataEntries)
      onchange?.({ ...data, rawSource: updated })
    } else {
      onchange?.({ ...data, rawSource: editorContent })
    }
    showEditor = false
  }

  function closeEditor() {
    showEditor = false
  }
</script>

<div class="artifact-card" style="width: {width};">
  {#if editable}
    <div class="artifact-header">
      <span class="artifact-label">{alt}</span>
      <button class="edit-data-btn" onclick={openEditor} type="button">Edit Source</button>
    </div>
  {/if}
  {#if useSrcdoc}
    <iframe
      srcdoc={srcdocContent}
      class="artifact-iframe"
      class:no-interact={editable}
      style="height: {height};"
      sandbox="allow-scripts allow-same-origin"
      title={alt}
    ></iframe>
  {:else if iframeSrc}
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
      {#if editable}
        <button class="edit-data-btn" onclick={openEditor} type="button">Add Source</button>
      {/if}
    </div>
  {/if}
</div>

{#if showEditor}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="editor-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeEditor() }}>
    <div class="editor-dialog">
      <div class="editor-header">
        <h3>Edit Artifact</h3>
        <div class="editor-tabs">
          <button class:active={editorMode === 'data'} onclick={() => editorMode = 'data'} type="button">Data</button>
          <button class:active={editorMode === 'source'} onclick={() => editorMode = 'source'} type="button">Source</button>
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
          {#each dataEntries as entry, i}
            <div class="data-row">
              <input class="col-label" bind:value={entry.label} placeholder="Name" />
              <input class="col-lat" bind:value={entry.lat} placeholder="Lat" type="number" step="any" />
              <input class="col-lng" bind:value={entry.lng} placeholder="Lng" type="number" step="any" />
              <input class="col-value" bind:value={entry.value} placeholder="Info" />
              <button class="remove-row" onclick={() => removeEntry(i)} type="button">&times;</button>
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
  .artifact-card {
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    border-radius: 4px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.02);
  }
  .artifact-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    gap: 8px;
  }
  .artifact-icon {
    font-size: 2rem;
  }

  /* Editor overlay */
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

  /* Editor tabs */
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

  /* Data editor */
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
  .col-label { flex: 2; min-width: 0; }
  .col-lat, .col-lng { flex: 1; min-width: 0; }
  .col-value { flex: 1.5; min-width: 0; }
  .col-action { width: 24px; flex-shrink: 0; }
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
</style>
