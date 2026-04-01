<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { applyMutation } from '$lib/utils/mutations'
  import { get } from 'svelte/store'
  import { API_URL } from '$lib/api'
  import { chatDraft } from '$lib/stores/chat'
  import { getResolvedConfig, buildAtRef, buildSourceWithConfig, type ArtifactConfigField } from '$lib/utils/artifact-config'

  interface Artifact {
    id: string
    name: string
    description: string
    type: string
    source: string
    config: Record<string, ArtifactConfigField> | unknown
    builtIn: boolean
  }

  interface ArtifactGroup {
    key: string
    label: string
    badge: string
    items: Artifact[]
  }

  let artifacts = $state<Artifact[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let inserting = $state<string | null>(null)

  // Config editor state
  let editingArtifactId = $state<string | null>(null)
  let configJson = $state('')
  let configError = $state<string | null>(null)

  // Collapse state — tracks which groups are expanded (all open by default)
  let expandedGroups = $state<Set<string>>(new Set(['chart', 'diagram', 'map', 'visualization']))

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

  // Group artifacts by type
  let groups = $derived.by(() => {
    const byType: Record<string, Artifact[]> = {}
    for (const a of artifacts) {
      ;(byType[a.type] ??= []).push(a)
    }

    const typeLabels: Record<string, { label: string; badge: string }> = {
      chart: { label: 'Charts', badge: 'C' },
      diagram: { label: 'Diagrams', badge: 'D' },
      map: { label: 'Maps', badge: 'M' },
      visualization: { label: 'Visualization', badge: 'V' },
    }

    const typeOrder = ['chart', 'diagram', 'map', 'visualization']
    const result: ArtifactGroup[] = []

    for (const type of typeOrder) {
      if (byType[type]?.length) {
        const meta = typeLabels[type]
        result.push({ key: type, label: meta.label, badge: meta.badge, items: byType[type] })
      }
    }

    // Any remaining types not in typeOrder
    for (const [type, items] of Object.entries(byType)) {
      if (!typeOrder.includes(type)) {
        const meta = typeLabels[type] ?? { label: type, badge: '?' }
        result.push({ key: type, label: meta.label, badge: meta.badge, items })
      }
    }

    return result
  })

  function toggleGroup(key: string) {
    const next = new Set(expandedGroups)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    expandedGroups = next
  }

  function openConfigEditor(artifact: Artifact) {
    if (editingArtifactId === artifact.id) {
      editingArtifactId = null
      return
    }
    editingArtifactId = artifact.id
    configError = null
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

  async function insertArtifact(artifact: Artifact, useConfig: boolean = false) {
    const slideId = get(activeSlideId)
    if (!slideId || inserting) return

    inserting = artifact.id
    configError = null

    try {
      let resolvedConfig = getResolvedConfig(artifact)
      if (useConfig && configJson.trim()) {
        try {
          resolvedConfig = { ...resolvedConfig, ...JSON.parse(configJson) }
        } catch {
          configError = 'Invalid JSON. Please fix and try again.'
          inserting = null
          return
        }
      }

      let finalSource = Object.keys(resolvedConfig).length > 0
        ? buildSourceWithConfig(artifact.source, resolvedConfig)
        : artifact.source

      const sourceIsUrl = isUrl(finalSource)
      const src = sourceIsUrl
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
              ...(sourceIsUrl ? {} : { rawSource: finalSource }),
              alt: displayName(artifact.name),
              artifactId: artifact.id,
              artifactName: artifact.name,
              config: resolvedConfig,
              width: '60%',
              autoSize: true,
              aspectRatio: 4 / 3, // data-viz artifacts suit 4:3; blank artifacts (ModulePicker) default 16:9
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

  let copied = $state<string | null>(null)

  async function copyConfig(artifact: Artifact) {
    const config = getResolvedConfig(artifact)
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    copied = artifact.id
    setTimeout(() => { if (copied === artifact.id) copied = null }, 1500)
  }

  function injectAtRef(artifact: Artifact) {
    chatDraft.set(buildAtRef(artifact))
  }

  function hasConfig(artifact: Artifact): boolean {
    const cfg = artifact.config as Record<string, unknown> | null
    return cfg != null && typeof cfg === 'object' && Object.keys(cfg).length > 0
  }

  // Clean artifact display text — strip noise, keep just the core name
  function cleanText(str: string): string {
    return str
      .replace(/\binteractive\b/gi, '')
      .replace(/\bvisuali[sz]ation\b/gi, '')
      .replace(/\bdemo(nstration)?\b/gi, '')
      .replace(/\bfrom\s+creative[\s-]*clawing[\s-]*(gallery)?\b/gi, '')
      .replace(/\bcreative[\s-]*clawing\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  function displayName(name: string): string {
    const clean = cleanText(name)
    // Capitalize first letter
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : name
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
    <div class="group-list">
      {#each groups as group (group.key)}
        <div class="group">
          <button class="group-header" onclick={() => toggleGroup(group.key)}>
            <span class="group-badge">{group.badge}</span>
            <span class="group-label">{group.label}</span>
            <span class="group-count">{group.items.length}</span>
            <span class="group-chevron" class:open={expandedGroups.has(group.key)}>
              &#9206;
            </span>
          </button>

          {#if expandedGroups.has(group.key)}
            <div class="group-items">
              {#each group.items as artifact (artifact.id)}
                <div class="artifact-row" class:editing={editingArtifactId === artifact.id}>
                  <div class="artifact-main">
                    <div class="artifact-top">
                      <div class="artifact-info">
                        <span class="artifact-name">{displayName(artifact.name)}</span>
                        {#if artifact.description}
                          <span class="artifact-desc">{artifact.description}</span>
                        {/if}
                      </div>
                      <div class="artifact-actions">
                        <button
                          class="act-btn act-insert"
                          onclick={() => insertArtifact(artifact, false)}
                          disabled={inserting !== null || !$activeSlideId}
                          title={$activeSlideId ? 'Insert with defaults' : 'Select a slide first'}
                          aria-label={$activeSlideId ? 'Insert with defaults' : 'Select a slide first'}
                        >
                          {#if inserting === artifact.id}
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="3" cy="6" r="1" fill="currentColor"><animate attributeName="opacity" values="1;.3;1" dur=".8s" repeatCount="indefinite"/></circle><circle cx="6" cy="6" r="1" fill="currentColor"><animate attributeName="opacity" values="1;.3;1" dur=".8s" begin=".15s" repeatCount="indefinite"/></circle><circle cx="9" cy="6" r="1" fill="currentColor"><animate attributeName="opacity" values="1;.3;1" dur=".8s" begin=".3s" repeatCount="indefinite"/></circle></svg>
                          {:else}
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/></svg>
                          {/if}
                        </button>
                        {#if hasConfig(artifact)}
                          <button
                            class="act-btn"
                            class:act-active={editingArtifactId === artifact.id}
                            onclick={() => openConfigEditor(artifact)}
                            title="Configure data before inserting"
                          >
                            {#if editingArtifactId === artifact.id}
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
                            {:else}
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M9.7 7.2l.5.3a.4.4 0 01.1.5l-.6 1a.4.4 0 01-.5.2l-.6-.2a3.6 3.6 0 01-.8.5l-.1.6a.4.4 0 01-.4.3H6.1a.4.4 0 01-.4-.3l-.1-.6a3.6 3.6 0 01-.8-.5l-.6.2a.4.4 0 01-.5-.2l-.5-1a.4.4 0 01.1-.5l.5-.3a3.5 3.5 0 010-1l-.5-.3a.4.4 0 01-.1-.5l.5-1a.4.4 0 01.5-.2l.6.2a3.6 3.6 0 01.8-.5l.1-.6A.4.4 0 016.1 3h1.2a.4.4 0 01.4.3l.1.6c.3.1.6.3.8.5l.6-.2a.4.4 0 01.5.2l.5 1a.4.4 0 01-.1.5l-.5.3a3.5 3.5 0 010 1z"/></svg>
                            {/if}
                          </button>
                        {/if}
                        <button
                          class="act-btn"
                          class:act-copied={copied === artifact.id}
                          onclick={() => copyConfig(artifact)}
                          title="Copy config to clipboard"
                        >
                          {#if copied === artifact.id}
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5,6.5 5,9 9.5,3.5"/></svg>
                          {:else}
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><path d="M8 4V2.5A1 1 0 007 1.5H2.5A1 1 0 001.5 2.5V7A1 1 0 002.5 8H4"/></svg>
                          {/if}
                        </button>
                        <button
                          class="act-btn act-at"
                          onclick={() => injectAtRef(artifact)}
                          title="Send @artifact:{displayName(artifact.name).toLowerCase().replace(/\s+/g, '-')} to chat"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="6" cy="6" r="2"/><path d="M8 4.5v2.3a1.2 1.2 0 002.4 0V6a4.4 4.4 0 10-2.2 3.8"/></svg>
                        </button>
                      </div>
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
      {/each}
    </div>
  {/if}
</div>

<style>
  .artifacts-tab {
    padding: 4px;
    overflow-x: hidden;
  }

  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 12px;
    font-size: 11px;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
    line-height: 1.5;
  }

  .center-msg.error {
    color: var(--color-error, #ef4444);
  }

  .group-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Group header ── */
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .group-header:hover {
    background: var(--color-ghost-bg-hover, rgba(59, 115, 230, 0.12));
    border-color: var(--color-primary, #3B73E6);
  }

  .group-badge {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary, #3B73E6);
    color: #fff;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  .group-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text, #1f2937);
    flex: 1;
    text-align: left;
  }

  .group-count {
    font-size: 9px;
    color: var(--color-text-muted, #94a3b8);
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 5px;
    border-radius: 2px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .group-chevron {
    font-size: 10px;
    color: var(--color-text-muted, #94a3b8);
    transition: transform 0.15s;
    transform: rotate(0deg);
    flex-shrink: 0;
  }
  .group-chevron.open {
    transform: rotate(180deg);
  }

  /* ── Expanded item list ── */
  .group-items {
    display: flex;
    flex-direction: column;
    margin-left: 10px;
    padding-left: 8px;
    border-left: 1.5px solid var(--color-border, #e2e8f0);
  }

  .artifact-row {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border, #e2e8f0) 60%, transparent);
    transition: background 0.1s;
  }
  .artifact-row:last-child {
    border-bottom: none;
  }
  .artifact-row:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
  }
  .artifact-row.editing {
    background: rgba(59, 130, 246, 0.06);
  }

  .artifact-main {
    padding: 4px 6px;
  }

  .artifact-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .artifact-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .artifact-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text, #1f2937);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .artifact-desc {
    font-size: 9.5px;
    color: var(--color-text-muted, #94a3b8);
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Action buttons ── */
  .artifact-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .act-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    color: var(--color-text-muted, #94a3b8);
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    line-height: 1;
  }
  .act-btn:hover {
    color: var(--color-primary, #3B73E6);
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    border-color: var(--color-border, #e2e8f0);
  }
  .act-btn:active {
    background: var(--color-ghost-bg-hover, rgba(59, 115, 230, 0.12));
  }

  /* Insert button — the primary action, always visible border */
  .act-insert {
    color: var(--color-primary, #3B73E6);
    border-color: var(--color-primary, #3B73E6);
  }
  .act-insert:hover:not(:disabled) {
    background: var(--color-primary, #3B73E6);
    color: #fff;
  }
  .act-insert:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    border-color: var(--color-border, #e2e8f0);
    color: var(--color-text-muted, #94a3b8);
  }

  /* Active config toggle */
  .act-active {
    color: var(--color-primary, #3B73E6);
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    border-color: var(--color-primary, #3B73E6);
  }

  /* Copied state flash */
  .act-copied {
    color: var(--color-success, #166534);
    border-color: var(--color-success, #166534);
    background: rgba(22, 101, 52, 0.06);
  }

  /* @ button hint */
  .act-at:hover {
    color: var(--color-accent, #2FB8D6);
    border-color: var(--color-accent, #2FB8D6);
    background: rgba(47, 184, 214, 0.08);
  }

  /* ── Config editor ── */
  .config-editor {
    padding: 6px 6px 8px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-secondary, #f8fafc);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .config-label {
    font-size: 9px;
    font-weight: 700;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .config-textarea {
    width: 100%;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 10.5px;
    line-height: 1.5;
    padding: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 3px;
    background: var(--color-bg, #fff);
    color: var(--color-text, #1f2937);
    resize: vertical;
    box-sizing: border-box;
  }
  .config-textarea:focus {
    outline: none;
    border-color: var(--color-primary, #3B73E6);
    box-shadow: 0 0 0 1px var(--color-primary, #3B73E6);
  }

  .config-error {
    font-size: 10px;
    color: var(--color-error, #ef4444);
    margin: 0;
  }

  .insert-configured-btn {
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary, #3B73E6);
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: 3px;
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.12s, color 0.12s;
  }
  .insert-configured-btn:hover:not(:disabled) {
    background: var(--color-primary, #3B73E6);
    color: #fff;
  }
  .insert-configured-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
