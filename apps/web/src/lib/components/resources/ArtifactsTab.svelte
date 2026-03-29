<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { applyMutation } from '$lib/utils/mutations'
  import { get } from 'svelte/store'
  import { API_URL } from '$lib/api'

  interface ArtifactConfigField {
    type: string
    label: string
    default: unknown
    itemShape?: Record<string, string>
  }

  interface Artifact {
    id: string
    name: string
    description: string
    type: string
    source: string
    config: Record<string, ArtifactConfigField> | unknown
    builtIn: boolean
  }

  let artifacts = $state<Artifact[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let inserting = $state<string | null>(null)

  // Config editor state
  let editingArtifactId = $state<string | null>(null)
  let configJson = $state('')
  let configError = $state<string | null>(null)

  $effect(() => {
    fetch(`${API_URL}/api/artifacts`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        artifacts = data.artifacts ?? []
        loading = false
      })
      .catch((err) => {
        console.error('Failed to fetch artifacts:', err)
        error = 'Failed to load artifacts'
        loading = false
      })
  })

  function isUrl(str: string): boolean {
    return str.startsWith('http://') || str.startsWith('https://')
  }

  function openConfigEditor(artifact: Artifact) {
    if (editingArtifactId === artifact.id) {
      editingArtifactId = null
      return
    }
    editingArtifactId = artifact.id
    configError = null
    // Build default config from the artifact's config schema
    const cfg = artifact.config as Record<string, ArtifactConfigField> | null
    if (cfg && typeof cfg === 'object') {
      const defaults: Record<string, unknown> = {}
      for (const [key, field] of Object.entries(cfg)) {
        if (field && typeof field === 'object' && 'default' in field) {
          defaults[key] = field.default
        }
      }
      configJson = JSON.stringify(defaults, null, 2)
    } else {
      configJson = '{}'
    }
  }

  function buildSourceWithConfig(artifact: Artifact, configData: Record<string, unknown>): string {
    // Inject data-config as a JSON attribute on the body element
    const configStr = JSON.stringify(configData).replace(/"/g, '&quot;')
    // Replace <body> with <body data-config="...">
    let source = artifact.source
    if (source.includes('<body>')) {
      source = source.replace('<body>', `<body data-config="${configStr}">`)
    } else if (source.includes('<body ')) {
      source = source.replace('<body ', `<body data-config="${configStr}" `)
    }
    return source
  }

  async function insertArtifact(artifact: Artifact, useConfig: boolean = false) {
    const slideId = get(activeSlideId)
    if (!slideId || inserting) return

    inserting = artifact.id
    configError = null

    try {
      let finalSource = artifact.source
      if (useConfig && configJson.trim()) {
        try {
          const parsed = JSON.parse(configJson)
          finalSource = buildSourceWithConfig(artifact, parsed)
        } catch {
          configError = 'Invalid JSON. Please fix and try again.'
          inserting = null
          return
        }
      }

      // Use URL directly if source is a URL, otherwise create a blob from inline HTML
      const src = isUrl(finalSource)
        ? finalSource
        : URL.createObjectURL(new Blob([finalSource], { type: 'text/html' }))

      await applyMutation({
        action: 'addBlock',
        payload: {
          slideId,
          block: {
            type: 'artifact',
            zone: 'stage',
            data: {
              src,
              rawSource: finalSource,
              alt: artifact.name,
              width: '100%',
              height: '300px',
            },
          },
        },
      })

      editingArtifactId = null
    } catch (err) {
      console.error('Failed to insert artifact:', err)
    } finally {
      inserting = null
    }
  }

  const typeIcons: Record<string, string> = {
    chart: 'C',
    diagram: 'D',
    widget: 'JS',
    map: 'M',
  }

  function hasConfig(artifact: Artifact): boolean {
    const cfg = artifact.config as Record<string, unknown> | null
    return cfg != null && typeof cfg === 'object' && Object.keys(cfg).length > 0
  }
</script>

<div class="artifacts-tab">
  {#if loading}
    <div class="center-msg">Loading artifacts...</div>
  {:else if error}
    <div class="center-msg error">{error}</div>
  {:else if artifacts.length === 0}
    <div class="center-msg">No artifacts available yet. Run the seed script to add starter artifacts.</div>
  {:else}
    <div class="artifact-list">
      {#each artifacts as artifact (artifact.id)}
        <div class="artifact-card" class:editing={editingArtifactId === artifact.id}>
          <div class="artifact-main">
            <div class="artifact-header">
              <span class="type-badge">{typeIcons[artifact.type] ?? '?'}</span>
              <span class="artifact-name">{artifact.name}</span>
            </div>
            <p class="artifact-desc">{artifact.description}</p>
            <div class="artifact-actions">
              <button
                class="insert-btn"
                onclick={() => insertArtifact(artifact, false)}
                disabled={inserting !== null || !$activeSlideId}
                title={$activeSlideId ? 'Insert with defaults' : 'Select a slide first'}
              >
                {inserting === artifact.id ? 'Inserting...' : 'Insert'}
              </button>
              {#if hasConfig(artifact)}
                <button
                  class="config-btn"
                  onclick={() => openConfigEditor(artifact)}
                  title="Configure data before inserting"
                >
                  {editingArtifactId === artifact.id ? 'Close' : 'Configure'}
                </button>
              {/if}
            </div>
          </div>

          {#if editingArtifactId === artifact.id}
            <div class="config-editor">
              <label class="config-label">Edit data (JSON):</label>
              <textarea
                class="config-textarea"
                bind:value={configJson}
                rows="8"
                spellcheck="false"
              ></textarea>
              {#if configError}
                <p class="config-error">{configError}</p>
              {/if}
              <button
                class="insert-configured-btn"
                onclick={() => insertArtifact(artifact, true)}
                disabled={inserting !== null || !$activeSlideId}
              >
                Insert with Config
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .artifacts-tab {
    padding: 8px;
  }

  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 16px;
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
    line-height: 1.5;
  }

  .center-msg.error {
    color: #ef4444;
  }

  .artifact-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .artifact-card {
    display: flex;
    flex-direction: column;
    background: white;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    transition: border-color 0.15s, box-shadow 0.15s;
    overflow: hidden;
  }

  .artifact-card:hover {
    border-color: #93c5fd;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
  }

  .artifact-card.editing {
    border-color: #3b82f6;
  }

  .artifact-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
  }

  .artifact-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-badge {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .artifact-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text, #1f2937);
  }

  .artifact-desc {
    font-size: 11px;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.4;
  }

  .artifact-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .insert-btn,
  .config-btn {
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .insert-btn {
    background: #3b82f6;
    color: white;
    border: none;
  }
  .insert-btn:hover:not(:disabled) { opacity: 0.9; }
  .insert-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .config-btn {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
  }
  .config-btn:hover { background: #e2e8f0; color: #334155; }

  /* ── Config editor ── */
  .config-editor {
    padding: 8px 12px 12px;
    border-top: 1px solid var(--color-border, #e5e7eb);
    background: #f9fafb;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .config-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .config-textarea {
    width: 100%;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 8px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    background: white;
    color: var(--color-text, #1f2937);
    resize: vertical;
    box-sizing: border-box;
  }
  .config-textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .config-error {
    font-size: 10px;
    color: #ef4444;
    margin: 0;
  }

  .insert-configured-btn {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    align-self: flex-start;
    transition: opacity 0.15s;
  }
  .insert-configured-btn:hover:not(:disabled) { opacity: 0.9; }
  .insert-configured-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
