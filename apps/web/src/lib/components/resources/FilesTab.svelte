<script lang="ts">
  import { api } from '$lib/api'
  import { applyMutation } from '$lib/utils/mutations'
  import { activeSlideId } from '$lib/stores/ui'

  const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'

  let { deckId }: { deckId: string } = $props()

  let files = $state<any[]>([])
  let loading = $state(false)
  let uploading = $state(false)
  let dragging = $state(false)
  let fileInput: HTMLInputElement | undefined = $state()

  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])

  function isImage(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    return imageExts.has(ext)
  }

  function fileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'pdf') return '📄'
    if (ext === 'csv') return '📊'
    if (['xls', 'xlsx'].includes(ext)) return '📊'
    if (['doc', 'docx'].includes(ext)) return '📝'
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎬'
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵'
    if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return '📦'
    return '📎'
  }

  function fileUrl(fileId: string): string {
    return `${API_URL}/api/decks/${deckId}/files/${fileId}`
  }

  async function fetchFiles() {
    if (!deckId) return
    loading = true
    try {
      const res = await api.listFiles(deckId)
      files = res.files ?? []
    } catch (e) {
      console.error('Failed to fetch files:', e)
      files = []
    } finally {
      loading = false
    }
  }

  async function handleUpload(file: File) {
    if (!deckId) return
    uploading = true
    try {
      await api.uploadFile(deckId, file)
      await fetchFiles()
    } catch (e) {
      console.error('Upload failed:', e)
      alert('Upload failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      uploading = false
    }
  }

  function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) handleUpload(file)
    input.value = ''
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    dragging = true
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    dragging = false
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    const file = e.dataTransfer?.files?.[0]
    if (file) handleUpload(file)
  }

  async function handleDelete(fileId: string, filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return
    try {
      await api.deleteFile(deckId, fileId)
      await fetchFiles()
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  function handleFileClick(file: any) {
    const name = file.originalName ?? file.filename ?? 'file'
    if (!isImage(name)) return

    let slideId: string | null = null
    activeSlideId.subscribe((v) => { slideId = v })()

    if (!slideId) {
      alert('Select a slide first to insert the image.')
      return
    }

    const url = fileUrl(file.id ?? file._id)
    applyMutation({
      action: 'addBlock',
      payload: {
        slideId,
        block: {
          type: 'image',
          data: { src: url, alt: name }
        }
      }
    })
  }

  $effect(() => {
    if (deckId) fetchFiles()
  })
</script>

<div
  class="files-tab"
  class:dragging
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  role="region"
  aria-label="File browser"
>
  <div class="toolbar">
    <button class="upload-btn" onclick={() => fileInput?.click()} disabled={uploading || !deckId}>
      {uploading ? 'Uploading...' : 'Upload File'}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      class="file-input-hidden"
      onchange={onFileSelected}
    />
  </div>

  {#if loading && files.length === 0}
    <div class="empty-state">
      <p>Loading files...</p>
    </div>
  {:else if uploading}
    <div class="upload-overlay">
      <div class="spinner"></div>
      <p>Uploading...</p>
    </div>
  {/if}

  {#if dragging}
    <div class="drop-zone-overlay">
      <p>Drop file here</p>
    </div>
  {/if}

  {#if !loading && files.length === 0}
    <div class="empty-state">
      <div class="icon">📁</div>
      <p class="empty-text">No files yet — upload images to use in your slides</p>
    </div>
  {:else}
    <div class="file-grid">
      {#each files as file (file.id ?? file._id)}
        {@const name = file.originalName ?? file.filename ?? 'file'}
        {@const id = file.id ?? file._id}
        <div
          class="file-card"
          class:clickable={isImage(name)}
          onclick={() => handleFileClick(file)}
          role={isImage(name) ? 'button' : 'listitem'}
          tabindex={isImage(name) ? 0 : -1}
          onkeydown={(e) => { if (e.key === 'Enter') handleFileClick(file) }}
        >
          <button
            class="delete-btn"
            title="Delete file"
            onclick={(e) => { e.stopPropagation(); handleDelete(id, name) }}
          >✕</button>
          {#if isImage(name)}
            <div class="thumb-wrapper">
              <img
                src={fileUrl(id)}
                alt={name}
                class="thumbnail"
                loading="lazy"
              />
            </div>
          {:else}
            <div class="type-icon">{fileIcon(name)}</div>
          {/if}
          <p class="filename" title={name}>{name}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .files-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    position: relative;
    gap: 12px;
  }

  .files-tab.dragging {
    background: rgba(37, 99, 235, 0.04);
  }

  .toolbar {
    flex-shrink: 0;
  }

  .upload-btn {
    width: 100%;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: var(--color-primary, #2563eb);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .upload-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #1d4ed8);
  }

  .upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .file-input-hidden {
    display: none;
  }

  .drop-zone-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(37, 99, 235, 0.08);
    border: 2px dashed var(--color-primary, #2563eb);
    border-radius: 8px;
    z-index: 10;
    pointer-events: none;
  }

  .drop-zone-overlay p {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-primary, #2563eb);
  }

  .upload-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
  }

  .upload-overlay p {
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-border, #e5e7eb);
    border-top-color: var(--color-primary, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 20px;
  }

  .empty-state .icon {
    font-size: 28px;
    margin-bottom: 8px;
  }

  .empty-text {
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.5;
    margin: 0;
  }

  .file-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .file-card {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    background: var(--color-bg-secondary, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    padding: 6px 8px;
    gap: 8px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .file-card.clickable {
    cursor: pointer;
  }

  .file-card.clickable:hover {
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 1px var(--color-primary, #2563eb);
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 50%;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    z-index: 2;
    padding: 0;
    line-height: 1;
  }

  .delete-btn:hover {
    color: #dc2626;
    border-color: #dc2626;
    background: #fef2f2;
  }

  .thumb-wrapper {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-border, #e5e7eb);
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .type-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    background: var(--color-border, #e5e7eb);
    border-radius: 6px;
  }

  .filename {
    font-size: 11px;
    color: var(--color-text, #1f2937);
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    position: static;
    flex-shrink: 0;
  }
</style>
