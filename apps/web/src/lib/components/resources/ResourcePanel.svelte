<script lang="ts">
  import FilesTab from './FilesTab.svelte'
  import TemplatesTab from './TemplatesTab.svelte'
  import ArtifactsTab from './ArtifactsTab.svelte'
  import { activeResourceTab } from '$lib/stores/ui'

  import { currentDeck } from '$lib/stores/deck'
  let deckId = $derived($currentDeck?.id ?? '')

  const tabs: { key: 'files' | 'templates' | 'artifacts'; label: string }[] = [
    { key: 'files', label: 'Files' },
    { key: 'templates', label: 'Tmpl' },
    { key: 'artifacts', label: 'Visuals' },
  ]

  function setTab(key: typeof $activeResourceTab) {
    activeResourceTab.set(key)
  }
</script>

<div class="resource-panel">
  <div class="pill-bar" role="tablist" aria-label="Resource type">
    {#each tabs as tab}
      <button
        class="pill"
        class:active={$activeResourceTab === tab.key}
        role="tab"
        aria-selected={$activeResourceTab === tab.key}
        onclick={() => setTab(tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="tab-content" role="tabpanel" aria-label={$activeResourceTab}>
    {#if $activeResourceTab === 'files'}
      <FilesTab {deckId} />
    {:else if $activeResourceTab === 'templates'}
      <TemplatesTab />
    {:else if $activeResourceTab === 'artifacts'}
      <ArtifactsTab />
    {/if}
  </div>
</div>

<style>
  .resource-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .pill-bar {
    display: flex;
    gap: 2px;
    padding: 3px;
    margin: 8px;
    background: var(--color-bg-tertiary, #f1f5f9);
    border-radius: 6px;
    flex-shrink: 0;
  }

  .pill {
    flex: 1;
    padding: 4px 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    text-align: center;
    white-space: nowrap;
  }

  .pill:hover:not(.active) {
    color: var(--color-text, #1f2937);
  }

  .pill.active {
    background: var(--color-bg, #fff);
    color: var(--color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
