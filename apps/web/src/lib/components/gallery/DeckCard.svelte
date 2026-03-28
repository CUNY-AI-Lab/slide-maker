<script lang="ts">
  import { goto } from '$app/navigation';

  let { deck, ondelete, onshare }: { deck: any; ondelete: (id: string) => void; onshare?: (id: string) => void } = $props();

  let confirming = $state(false);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function handleClick() {
    goto(`/deck/${deck.id}`);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (confirming) {
      ondelete(deck.id);
      confirming = false;
    } else {
      confirming = true;
      setTimeout(() => { confirming = false; }, 3000);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="deck-card" onclick={handleClick}>
  <div class="card-preview">
    <span class="slide-icon">&#9655;</span>
  </div>
  <div class="card-info">
    <h3 class="card-title">{deck.name}</h3>
    <p class="card-meta">
      {#if deck.updatedAt}
        Edited {formatDate(deck.updatedAt)}
      {:else}
        New deck
      {/if}
    </p>
  </div>
  {#if onshare}
    <button
      class="share-btn"
      onclick={(e) => { e.stopPropagation(); onshare(deck.id); }}
      type="button"
      title="Share deck"
    >&#x1F517;</button>
  {/if}
  <button
    class="delete-btn"
    class:confirming
    onclick={handleDelete}
    type="button"
    title={confirming ? 'Click again to confirm' : 'Delete deck'}
  >
    {confirming ? 'Confirm?' : '✕'}
  </button>
</div>

<style>
  .deck-card {
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.2s;
    position: relative;
    text-align: left;
    font-family: var(--font-body);
  }

  .deck-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .card-preview {
    height: 120px;
    background: var(--color-bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--color-text-muted);
  }

  .slide-icon {
    opacity: 0.4;
  }

  .card-info {
    padding: 1rem;
  }

  .card-title {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .delete-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    font-family: var(--font-body);
    color: var(--color-text-secondary);
  }

  .deck-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: #fef2f2;
    color: var(--color-error);
    border-color: #fecaca;
  }

  .share-btn {
    position: absolute;
    top: 0.5rem;
    right: 3.5rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    font-family: var(--font-body);
    color: var(--color-text-secondary);
  }

  .deck-card:hover .share-btn {
    opacity: 1;
  }

  .share-btn:hover {
    background: #eff6ff;
    color: var(--color-primary);
    border-color: #93c5fd;
  }

  .delete-btn.confirming {
    opacity: 1;
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
  }
</style>
