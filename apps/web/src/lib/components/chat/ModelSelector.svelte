<script lang="ts">
  import { selectedModelId } from '$lib/stores/chat'
  import { API_URL } from '$lib/api'

  interface Model {
    id: string
    name: string
    provider: string
  }

  let models = $state<Model[]>([])
  let loading = $state(true)

  const grouped = $derived.by(() => {
    const groups: Record<string, Model[]> = {}
    for (const m of models) {
      const key = m.provider
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
    return groups
  })

  $effect(() => {
    fetch(`${API_URL}/api/providers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        models = data.models || []
        // If current selection is not in available models, pick the first one
        if (models.length > 0) {
          const current = $selectedModelId
          if (!models.find((m) => m.id === current)) {
            selectedModelId.set(models[0].id)
          }
        }
      })
      .catch(() => {
        models = []
      })
      .finally(() => {
        loading = false
      })
  })

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement
    selectedModelId.set(target.value)
  }
</script>

<div class="model-selector">
  {#if loading}
    <select disabled>
      <option>Loading models...</option>
    </select>
  {:else if models.length === 0}
    <select disabled>
      <option>No models available</option>
    </select>
  {:else}
    <select value={$selectedModelId} onchange={handleChange}>
      {#each Object.entries(grouped) as [provider, providerModels]}
        <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
          {#each providerModels as model}
            <option value={model.id}>{model.name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  {/if}
</div>

<style>
  .model-selector {
    padding: 6px 8px;
    border-bottom: 1px solid var(--color-border);
  }

  select {
    width: 100%;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
    outline: none;
  }

  select:focus {
    border-color: var(--color-primary);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
