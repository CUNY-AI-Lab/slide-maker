<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let nodes: Array<{ icon?: string; label: string; description?: string }> = $derived(
    Array.isArray(data.nodes)
      ? data.nodes.map((n: unknown) => {
          const node = n as Record<string, unknown>
          return {
            icon: typeof node.icon === 'string' ? node.icon : undefined,
            label: typeof node.label === 'string' ? node.label : '',
            description: typeof node.description === 'string' ? node.description : undefined,
          }
        })
      : []
  )
</script>

<div class="flow">
  {#each nodes as node, i}
    <div class="flow-node">
      <div class="flow-icon">
        {#if node.icon}
          {node.icon}
        {:else}
          {i + 1}
        {/if}
      </div>
      <div class="flow-body">
        <div class="flow-label">{node.label}</div>
        {#if node.description}
          <div class="flow-desc">{node.description}</div>
        {/if}
      </div>
    </div>
    {#if i < nodes.length - 1}
      <div class="flow-arrow"></div>
    {/if}
  {/each}
</div>

<style>
  .flow {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .flow-node {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .flow-icon {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: var(--teal, #2FB8D6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 700;
    font-size: 0.7rem;
    font-family: var(--font-display);
  }
  .flow-arrow {
    width: 2px;
    height: 0.6rem;
    background: var(--teal, #2FB8D6);
    margin-left: 0.9rem;
    opacity: 0.4;
  }
  .flow-body {
    min-width: 0;
  }
  .flow-label {
    font-weight: 600;
    font-size: 0.85rem;
    font-family: var(--font-display);
    line-height: 1.2;
  }
  .flow-desc {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
    line-height: 1.4;
  }
</style>
