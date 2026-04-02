<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  const url = $derived(String(data.url || ''))
  const caption = $derived(String(data.caption || ''))

  /**
   * Convert a video URL to an embeddable iframe src.
   * Supports YouTube, Vimeo, and Loom. Returns empty string for unsupported URLs.
   */
  const embedUrl = $derived.by(() => {
    if (!url) return ''
    try {
      const u = new URL(url)

      // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        let videoId = ''
        if (u.hostname.includes('youtu.be')) {
          videoId = u.pathname.slice(1)
        } else if (u.pathname.startsWith('/embed/')) {
          videoId = u.pathname.split('/embed/')[1]?.split(/[?/]/)[0] || ''
        } else {
          videoId = u.searchParams.get('v') || ''
        }
        if (videoId) return `https://www.youtube.com/embed/${videoId}`
      }

      // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
      if (u.hostname.includes('vimeo.com')) {
        if (u.pathname.startsWith('/video/')) {
          return `https://player.vimeo.com${u.pathname}`
        }
        const vimeoId = u.pathname.split('/').filter(Boolean)[0]
        if (vimeoId && /^\d+$/.test(vimeoId)) {
          return `https://player.vimeo.com/video/${vimeoId}`
        }
      }

      // Loom: loom.com/share/ID
      if (u.hostname.includes('loom.com') && u.pathname.startsWith('/share/')) {
        const loomId = u.pathname.split('/share/')[1]?.split(/[?/]/)[0] || ''
        if (loomId) return `https://www.loom.com/embed/${loomId}`
      }

      // Already an embed URL — pass through
      if (u.pathname.includes('/embed')) return url
    } catch {
      // Invalid URL
    }
    return ''
  })

  let editingUrl = $state(false)
  let inputUrl = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  function startEdit() {
    inputUrl = url
    editingUrl = true
    // Focus after Svelte renders the input
    requestAnimationFrame(() => inputEl?.focus())
  }

  function saveUrl() {
    const trimmed = inputUrl.trim()
    if (trimmed !== url) {
      onchange?.({ ...data, url: trimmed })
    }
    editingUrl = false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveUrl() }
    if (e.key === 'Escape') { editingUrl = false }
  }
</script>

<div class="video-wrapper">
  {#if embedUrl}
    <div class="video-frame">
      <iframe
        src={embedUrl}
        title={caption || 'Embedded video'}
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        class:no-interact={editable}
      ></iframe>
    </div>
    {#if caption}
      <p class="video-caption">{caption}</p>
    {/if}
  {:else if editable}
    {#if editingUrl}
      <!-- svelte-ignore a11y_autofocus -->
      <div class="video-placeholder editing">
        <input
          bind:this={inputEl}
          type="url"
          bind:value={inputUrl}
          placeholder="Paste YouTube, Vimeo, or Loom URL..."
          onkeydown={handleKeydown}
          onblur={saveUrl}
          class="url-input"
        />
        <p class="url-hint">Press Enter to save, Escape to cancel</p>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="video-placeholder" role="button" tabindex="0" onclick={startEdit} onkeydown={(e) => { if (e.key === 'Enter') startEdit() }}>
        <span class="placeholder-icon">▶</span>
        <p>{url ? 'Unsupported video URL' : 'Click to add a video URL'}</p>
        {#if url}<p class="url-preview">{url}</p>{/if}
      </div>
    {/if}
  {:else}
    <div class="video-placeholder">
      <span class="placeholder-icon">▶</span>
      <p>No video configured</p>
    </div>
  {/if}
</div>

<style>
  .video-wrapper {
    width: 100%;
  }
  .video-frame {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 */
    background: #000;
    border-radius: 4px;
    overflow: hidden;
  }
  .video-frame iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
  .video-frame iframe.no-interact {
    pointer-events: none;
  }
  .video-caption {
    font-size: 0.8rem;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
    margin: 6px 0 0;
    font-style: italic;
  }
  .video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px dashed var(--color-border, rgba(0, 0, 0, 0.15));
    border-radius: 4px;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.9rem;
    cursor: pointer;
    gap: 8px;
    padding: 16px;
  }
  .placeholder-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }
  .url-preview {
    font-size: 0.75rem;
    opacity: 0.6;
    word-break: break-all;
  }
  .video-placeholder.editing {
    cursor: default;
  }
  .url-input {
    width: 90%;
    max-width: 400px;
    padding: 8px 12px;
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    font-size: 0.875rem;
    outline: none;
    background: var(--color-bg, #fff);
    color: var(--color-text, #1a1a2e);
  }
  .url-hint {
    font-size: 0.7rem;
    opacity: 0.5;
    margin: 4px 0 0;
  }
</style>
