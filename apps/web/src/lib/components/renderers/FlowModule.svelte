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
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .flow-node {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: clamp(10px, 1.8cqi, 14px) clamp(14px, 2.8cqi, 22px);
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .flow-icon {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: var(--accent-cyan, #64b5f6);
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
    font-size: 1.2rem;
    color: rgba(240, 240, 240, 0.65);
  }
  .flow-arrow::after {
    content: '→';
  }
  .flow-body {
    min-width: 0;
  }
  .flow-label {
    font-weight: 600;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    font-family: var(--font-display);
    line-height: 1.2;
  }
  .flow-desc {
    font-size: clamp(0.7rem, 1cqi, 0.85rem);
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
    line-height: 1.4;
  }
</style>
