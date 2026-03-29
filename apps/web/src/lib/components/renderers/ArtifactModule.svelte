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

  // Resolve relative /api/ URLs to absolute for blob/srcdoc contexts
  function resolveUrls(html: string): string {
    return html.replace(/(href|src)=['"]\/api\//g, `$1="${API_URL}/api/`)
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

  // Edit mode
  let showEditor = $state(false)
  let editorContent = $state('')

  function openEditor() {
    editorContent = data.rawSource ?? ''
    showEditor = true
  }

  function saveEditor() {
    onchange?.({ ...data, rawSource: editorContent })
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
        <h3>Edit Artifact HTML</h3>
        <button class="close-btn" onclick={closeEditor} type="button">&times;</button>
      </div>
      <textarea
        class="source-editor"
        bind:value={editorContent}
        spellcheck="false"
        placeholder="Paste full HTML source here..."
      ></textarea>
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
</style>
