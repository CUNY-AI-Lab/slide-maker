<script lang="ts">
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { applyMutation } from '$lib/utils/mutations'
  import { get } from 'svelte/store'

  interface Artifact {
    id: string
    name: string
    description: string
    type: string
    source: string
    config: unknown
    builtIn: boolean
  }

  let artifacts = $state<Artifact[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let inserting = $state<string | null>(null)

  $effect(() => {
    const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'
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

  async function insertArtifact(artifact: Artifact) {
    const slideId = get(activeSlideId)
    if (!slideId || inserting) return

    inserting = artifact.id

    try {
      // Create a data URI from the source HTML
      const blob = new Blob([artifact.source], { type: 'text/html' })
      const src = URL.createObjectURL(blob)

      await applyMutation({
        action: 'addBlock',
        payload: {
          slideId,
          block: {
            type: 'artifact',
            zone: 'stage',
            data: {
              src,
              alt: artifact.name,
              width: '100%',
              height: '300px',
            },
          },
        },
      })
    } catch (err) {
      console.error('Failed to insert artifact:', err)
    } finally {
      inserting = null
    }
  }

  const typeIcons: Record<string, string> = {
    chart: 'C',
    diagram: 'D',
    widget: 'W',
    map: 'M',
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
        <button
          class="artifact-card"
          onclick={() => insertArtifact(artifact)}
          disabled={inserting !== null || !$activeSlideId}
          title={$activeSlideId ? `Insert ${artifact.name} into current slide` : 'Select a slide first'}
        >
          <div class="artifact-header">
            <span class="type-badge">{typeIcons[artifact.type] ?? '?'}</span>
            <span class="artifact-name">{artifact.name}</span>
          </div>
          <p class="artifact-desc">{artifact.description}</p>
          {#if inserting === artifact.id}
            <span class="inserting-label">Inserting...</span>
          {/if}
        </button>
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
    gap: 4px;
    padding: 10px 12px;
    background: white;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
    position: relative;
  }

  .artifact-card:hover:not(:disabled) {
    border-color: #93c5fd;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
  }

  .artifact-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .inserting-label {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 10px;
    color: #3b82f6;
    font-weight: 500;
  }
</style>
