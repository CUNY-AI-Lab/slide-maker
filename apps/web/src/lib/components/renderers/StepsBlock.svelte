<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let steps: Array<{ label: string; content: string }> = $derived(
    Array.isArray(data.steps)
      ? data.steps.map((s: unknown) => {
          const step = s as Record<string, unknown>
          return {
            label: typeof step.label === 'string' ? step.label : '',
            content: typeof step.content === 'string' ? step.content : ''
          }
        })
      : []
  )
</script>

<ol class="steps-block">
  {#each steps as step, i}
    <li class="step">
      <span class="step-number">{i + 1}</span>
      <div class="step-body">
        <strong class="step-label">{step.label}</strong>
        <p class="step-content">{step.content}</p>
      </div>
    </li>
  {/each}
</ol>

<style>
  .steps-block {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .step-number {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    background: var(--color-primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: var(--font-display);
  }
  .step-body {
    flex: 1;
    min-width: 0;
  }
  .step-label {
    font-size: 0.9rem;
    display: block;
    margin-bottom: 0.15rem;
  }
  .step-content {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
</style>
