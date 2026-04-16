<script lang="ts">
  import type { PendingMutation } from '$lib/stores/pending-mutations'

  interface Props {
    mutation: PendingMutation
    onaccept: (id: string) => void
    onreject: (id: string) => void
  }

  let { mutation, onaccept, onreject }: Props = $props()
</script>

<div
  class="mutation-card"
  class:accepted={mutation.status === 'accepted'}
  class:rejected={mutation.status === 'rejected'}
  class:failed={mutation.status === 'failed'}
>
  <div class="mutation-main">
    <span class="mutation-summary">{mutation.summary}</span>
    <div class="mutation-actions">
      {#if mutation.status === 'pending' || mutation.status === 'failed'}
        <button class="ghost-btn accept" onclick={() => onaccept(mutation.id)} title={mutation.status === 'failed' ? 'Retry' : 'Accept'}>&#10003;</button>
        <button class="ghost-btn reject" onclick={() => onreject(mutation.id)} title="Reject">&#10005;</button>
      {:else}
        <span class="mutation-status-badge">{mutation.status}</span>
      {/if}
    </div>
  </div>
  {#if mutation.status === 'failed' && mutation.error}
    <div class="mutation-error" role="alert">Failed: {mutation.error}</div>
  {/if}
</div>

<style>
  .mutation-card {
    display: flex;
    flex-direction: column;
    padding: 5px 10px;
    margin: 3px 0;
    border: 1px solid var(--color-border, #e5e7eb);
    border-left: 3px solid var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    font-size: 12px;
    gap: 4px;
  }

  .mutation-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mutation-card.accepted {
    border-left-color: var(--color-success-accent);
    opacity: 0.7;
  }

  .mutation-card.rejected {
    border-left-color: var(--color-error);
    opacity: 0.45;
  }

  .mutation-card.failed {
    border-left-color: var(--color-error);
    background: color-mix(in srgb, var(--color-error) 6%, transparent);
  }

  .mutation-error {
    font-size: 11px;
    color: var(--color-error);
    word-break: break-word;
  }

  .mutation-summary {
    flex: 1;
    color: var(--color-text);
  }

  .mutation-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .ghost-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .ghost-btn.accept {
    color: var(--color-success-accent);
  }

  .ghost-btn.accept:hover {
    background: color-mix(in srgb, var(--color-success-accent) 10%, transparent);
    border-color: var(--color-success-accent);
  }

  .ghost-btn.reject {
    color: var(--color-error);
  }

  .ghost-btn.reject:hover {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    border-color: var(--color-error);
  }

  .mutation-status-badge {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }
</style>
