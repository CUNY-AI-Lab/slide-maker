<script lang="ts">
  import FilesTab from './FilesTab.svelte'
  import TemplatesTab from './TemplatesTab.svelte'
  import ArtifactsTab from './ArtifactsTab.svelte'
  import ThemesTab from './ThemesTab.svelte'
  import { activeResourceTab } from '$lib/stores/ui'

  let activeTab = $state<'files' | 'templates' | 'artifacts' | 'themes'>('templates')
  import { currentDeck } from '$lib/stores/deck'
  let deckId = $derived($currentDeck?.id ?? '')

  $effect(() => {
    const unsub = activeResourceTab.subscribe((v) => { activeTab = v })
    return unsub
  })

  const tabs: { key: 'files' | 'templates' | 'artifacts' | 'themes'; label: string }[] = [
    { key: 'files', label: 'Files' },
    { key: 'templates', label: 'Templates' },
    { key: 'artifacts', label: 'Artifacts' },
    { key: 'themes', label: 'Themes' },
  ]

  function setTab(key: typeof activeTab) {
    activeResourceTab.set(key)
  }
</script>

<div class="resource-panel">
  <div class="tab-bar" role="tablist" aria-label="Resources">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.key}
        role="tab"
        aria-selected={activeTab === tab.key}
        onclick={() => setTab(tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="tab-content">
    {#if activeTab === 'files'}
      <FilesTab {deckId} />
    {:else if activeTab === 'templates'}
      <TemplatesTab />
    {:else if activeTab === 'artifacts'}
      <ArtifactsTab />
    {:else if activeTab === 'themes'}
      <ThemesTab />
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

  .tab-bar {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 0 8px;
    border-bottom: 1px solid var(--color-bg-tertiary, #f1f5f9);
    flex-shrink: 0;
  }

  .tab-btn {
    padding: 8px 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    text-align: center;
    white-space: nowrap;
    min-width: max-content;
  }

  .tab-btn:hover {
    color: var(--color-text, #1f2937);
  }

  .tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
</style>
