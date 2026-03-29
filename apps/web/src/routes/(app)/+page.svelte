<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api } from '$lib/api';
  import { currentUser } from '$lib/stores/auth';
  import DeckGrid from '$lib/components/gallery/DeckGrid.svelte';
  import NewDeckDialog from '$lib/components/gallery/NewDeckDialog.svelte';
  import ShareDeckDialog from '$lib/components/gallery/ShareDeckDialog.svelte';

  let decks = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showNewDeck = $state(false);
  let sharingDeckId = $state<string | null>(null);
  let user = $state<any>(null);

  currentUser.subscribe((u) => {
    user = u;
  });

  onMount(async () => {
    await loadDecks();
  });

  async function loadDecks() {
    loading = true;
    error = '';
    try {
      const res = await api.listDecks();
      decks = res.decks;
    } catch (err: any) {
      error = err.message || 'Failed to load decks';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteDeck(id);
      decks = decks.filter((d) => d.id !== id);
    } catch (err: any) {
      error = err.message || 'Failed to delete deck';
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
      currentUser.set(null);
      goto(`${base}/login`);
    } catch {
      goto(`${base}/login`);
    }
  }
</script>

<svelte:head>
  <title>My Decks - CUNY AI Lab Slide Wiz</title>
</svelte:head>

<div class="gallery-page">
  <header class="gallery-header">
    <div class="header-left">
      <h1><span class="brand-slide">Slide</span> <span class="brand-wiz">Wiz</span></h1>
    </div>
    <div class="header-right">
      {#if user}
        <span class="user-name">{user.name}</span>
        {#if user.role === 'admin'}
          <a href="{base}/admin" class="admin-link">Admin</a>
        {/if}
      {/if}
      <button class="btn-logout" onclick={handleLogout}>Sign Out</button>
    </div>
  </header>

  <main class="gallery-main">
    <div class="toolbar">
      <button class="btn-new" onclick={() => (showNewDeck = true)}>
        + New Deck
      </button>
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <p class="loading-text">Loading decks...</p>
    {:else}
      <DeckGrid {decks} ondelete={handleDelete} onshare={(id) => (sharingDeckId = id)} />
    {/if}
  </main>

  <NewDeckDialog bind:open={showNewDeck} />

  {#if sharingDeckId}
    <ShareDeckDialog deckId={sharingDeckId} onclose={() => (sharingDeckId = null)} />
  {/if}
</div>

<style>
  .gallery-page {
    min-height: 100vh;
    background: var(--color-bg-secondary);
  }

  .gallery-header {
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left h1 {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 700;
  }

  .brand-slide {
    color: #1a1a2e;
  }
  .brand-wiz {
    color: #1D3A83;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-name {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .admin-link {
    font-size: 0.8125rem;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    transition: background 0.15s;
  }

  .admin-link:hover {
    background: var(--color-bg-secondary);
  }

  .btn-logout {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 0.375rem 0.875rem;
    cursor: pointer;
    font-family: var(--font-body);
    transition: background 0.15s;
  }

  .btn-logout:hover {
    background: var(--color-bg-secondary);
  }

  .gallery-main {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem;
  }

  .toolbar {
    margin-bottom: 1.5rem;
  }

  .btn-new {
    padding: 0.625rem 1.25rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-new:hover {
    background: var(--color-primary-hover);
  }

  .error-message {
    background: #fef2f2;
    color: var(--color-error);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #fecaca;
    margin-bottom: 1.5rem;
  }

  .loading-text {
    text-align: center;
    color: var(--color-text-muted);
    padding: 3rem;
  }
</style>
