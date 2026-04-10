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
        <h3>{panel.title}</h3>
      {/if}
      <div class="panel-content">
        {@html renderContent(panel.content)}
      </div>
    </div>
  {/each}
</div>

<style>
  .comparison {
    display: flex;
    gap: clamp(12px, 2.5cqi, 20px);
    width: 100%;
    font-family: var(--font-body);
  }
  .comparison-panel {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: clamp(14px, 3cqi, 24px);
  }
  .comparison-panel h3 {
    font-size: clamp(0.9rem, 1.6cqi, 1.3rem);
    margin: 0 0 8px 0;
    font-family: var(--font-display);
    font-weight: 600;
  }
  .panel-content {
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
  }
</style>
