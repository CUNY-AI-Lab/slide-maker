<script lang="ts">
  import { renderContent } from '$lib/utils/markdown'

  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let panels: Array<{ title: string; content: string }> = $derived(
    Array.isArray(data.panels)
      ? data.panels.map((p: unknown) => {
          const panel = p as Record<string, unknown>
          return {
            title: typeof panel.title === 'string' ? panel.title : '',
            content: typeof panel.content === 'string' ? panel.content : '',
          }
        })
      : []
  )
</script>

<div class="comparison">
  {#each panels as panel}
    <div class="comparison-panel">
      {#if panel.title}
        <h4>{panel.title}</h4>
      {/if}
      <div class="panel-content">
        {@html renderContent(panel.content)}
      </div>
    </div>
  {/each}
</div>

<style>
  .comparison {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(45%, 1fr));
    border: 1px solid var(--color-border);
    border-radius: 6px;
    overflow: hidden;
    font-family: var(--font-body);
  }
  .comparison-panel {
    padding: clamp(0.75rem, 1.5cqi, 1.25rem);
  }
  .comparison-panel + .comparison-panel {
    border-left: 1px solid var(--color-border);
  }
  .comparison-panel h4 {
    color: #79c0ff;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    font-size: clamp(0.8rem, 1.2cqi, 1rem);
    font-family: var(--font-display);
  }
  .panel-content {
    font-size: clamp(0.75rem, 1.1cqi, 0.9rem);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
  @container (max-width: 500px) {
    .comparison {
      grid-template-columns: 1fr;
    }
    .comparison-panel + .comparison-panel {
      border-left: none;
      border-top: 1px solid var(--color-border);
    }
  }
</style>
