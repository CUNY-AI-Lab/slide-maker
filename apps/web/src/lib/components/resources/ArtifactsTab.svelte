<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { applyMutation } from '$lib/utils/mutations'
  import { get } from 'svelte/store'
  import { chatDraft, switchToChat } from '$lib/stores/chat'
  import { artifactsStore, ensureArtifactsLoaded, type ArtifactDef } from '$lib/stores/artifacts'
  import {
    getResolvedConfig,
  } from '$lib/utils/artifact-config'

  interface ArtifactGroup {
    key: string
    label: string
    badge: string
    items: ArtifactDef[]
  }

  let artifacts = $derived($artifactsStore)
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
    ensureArtifactsLoaded()
      .then(() => { loading = false })
      .catch(() => { error = 'Failed to load artifacts'; loading = false })
  })

  // Group artifacts by type
  let groups = $derived.by(() => {
    const byType: Record<string, ArtifactDef[]> = {}
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

  function openConfigEditor(artifact: ArtifactDef) {
    if (editingArtifactId === artifact.id) {
      editingArtifactId = null
      return
    }
    editingArtifactId = artifact.id
    configError = null
    configJson = JSON.stringify(getResolvedConfig(artifact), null, 2)
  }

  function getZoneForActiveSlide(): string {
    const deck = get(currentDeck)
    const slideId = get(activeSlideId)
    if (!deck || !slideId) return 'stage'
    const slide = deck.slides.find((s: any) => s.id === slideId)
    if (!slide) return 'stage'
    const layout = slide.layout
    if (layout === 'title-slide' || layout === 'layout-divider' || layout === 'closing-slide') return 'hero'
    if (layout === 'layout-split') return 'stage'
    return 'main'
  }

  async function insertArtifact(artifact: ArtifactDef, useConfig: boolean = false) {
    const slideId = get(activeSlideId)
    if (!slideId || inserting) return

    inserting = artifact.id
    configError = null

    try {
      let configData = getResolvedConfig(artifact)
      if (useConfig && configJson.trim()) {
        try {
          configData = JSON.parse(configJson)
        } catch {
          configError = 'Invalid JSON. Please fix and try again.'
          inserting = null
          return
        }
      }

      await applyMutation({
        action: 'addBlock',
        payload: {
          slideId,
          block: {
            type: 'artifact',
            zone: getZoneForActiveSlide(),
            data: buildArtifactReferenceData(artifact, configData),
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

  async function copyConfig(artifact: ArtifactDef) {
    const config = getResolvedConfig(artifact)
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    copied = artifact.id
    setTimeout(() => { if (copied === artifact.id) copied = null }, 1500)
  }

  function injectAtRef(artifact: ArtifactDef) {
    chatDraft.set(`@artifact:${artifact.name}`)
    switchToChat.set(true)
  }

  function hasConfig(artifact: ArtifactDef): boolean {
    const cfg = artifact.config as Record<string, unknown> | null
    return cfg != null && typeof cfg === 'object' && Object.keys(cfg).length > 0
  }

  function buildArtifactReferenceData(artifact: ArtifactDef, config: Record<string, unknown>) {
    return {
      registryId: artifact.id,
      config,
      alt: displayName(artifact.name),
      width: typeof config.width === 'string' ? config.width : '100%',
      height: typeof config.height === 'string' ? config.height : '400px',
    }
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
                          class="insert-btn"
                          onclick={() => insertArtifact(artifact, false)}
                          disabled={inserting !== null || !$activeSlideId}
                          title={$activeSlideId ? 'Insert with defaults' : 'Select a slide first'}
                        >
                          {inserting === artifact.id ? '...' : '+'}
                        </button>
                        {#if hasConfig(artifact)}
                          <button
                            class="config-btn"
                            onclick={() => openConfigEditor(artifact)}
                            title="Configure data before inserting"
                          >
                            {editingArtifactId === artifact.id ? '\u00d7' : '\u2699'}
                          </button>
                        {/if}
                        <button
                          class="icon-btn"
                          onclick={() => copyConfig(artifact)}
                          title="Copy config to clipboard"
                        >
                          {copied === artifact.id ? '\u2713' : '\u2398'}
                        </button>
                        <button
                          class="icon-btn"
                          onclick={() => injectAtRef(artifact)}
                          title="Send @reference to chat"
                        >
                          @
                        </button>
                      </div>
                    </div>
                  </div>

                  {#if editingArtifactId === artifact.id}
                    <div class="config-editor">
                      <label class="config-label" for={"json-" + artifact.id}>Edit data (JSON):</label>
                      <textarea
                        class="config-textarea"
                        id={"json-" + artifact.id}
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
    padding: 6px;
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

  .group-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ── Group header (collapsed row) ── */
  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .group-header:hover {
    background: var(--color-ghost-bg-hover, rgba(59, 115, 230, 0.12));
    border-color: #93c5fd;
  }

  .group-badge {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .group-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text, #1f2937);
    flex: 1;
    text-align: left;
  }

  .group-count {
    font-size: 10px;
    color: var(--color-text-muted, #94a3b8);
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 6px;
    border-radius: 9px;
    font-weight: 500;
  }

  .group-chevron {
    font-size: 11px;
    color: var(--color-text-muted, #94a3b8);
    transition: transform 0.2s;
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
    margin-left: 12px;
    padding-left: 10px;
    border-left: 2px solid var(--color-border, #e5e7eb);
  }

  .artifact-row {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    transition: background 0.1s;
  }
  .artifact-row:last-child {
    border-bottom: none;
  }
  .artifact-row:hover {
    background: rgba(59, 130, 246, 0.03);
  }
  .artifact-row.editing {
    background: rgba(59, 130, 246, 0.05);
  }

  .artifact-main {
    padding: 6px 8px;
  }

  .artifact-top {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .artifact-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .artifact-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text, #1f2937);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .artifact-desc {
    font-size: 10px;
    color: var(--color-text-muted, #94a3b8);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .artifact-actions {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .insert-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 14px;
    font-weight: 700;
    background: transparent;
    color: var(--color-primary, #3B73E6);
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s;
    line-height: 1;
  }
  .insert-btn:hover:not(:disabled) { background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08)); }
  .insert-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .config-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 13px;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    line-height: 1;
  }
  .config-btn:hover { background: #e2e8f0; color: #334155; }

  .icon-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 11px;
    font-weight: 700;
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    line-height: 1;
  }
  .icon-btn:hover { background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08)); color: var(--color-primary, #3B73E6); }

  /* ── Config editor ── */
  .config-editor {
    padding: 8px 8px 10px;
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
    border-color: var(--color-primary, #3B73E6);
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
    background: transparent;
    color: var(--color-primary, #3B73E6);
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.15s;
  }
  .insert-configured-btn:hover:not(:disabled) { background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08)); }
  .insert-configured-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
