<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api, API_URL } from '$lib/api';
  import { currentUser } from '$lib/stores/auth';
  import DeckGrid from '$lib/components/gallery/DeckGrid.svelte';
  import NewDeckDialog from '$lib/components/gallery/NewDeckDialog.svelte';
  import ShareDeckDialog from '$lib/components/gallery/ShareDeckDialog.svelte';

  let decks = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showNewDeck = $state(false);

  // Change password
  let showChangePassword = $state(false);
  let cpCurrent = $state('');
  let cpNew = $state('');
  let cpConfirm = $state('');
  let cpError = $state('');
  let cpSuccess = $state('');
  let cpSaving = $state(false);

  async function handleChangePassword() {
    cpError = '';
    cpSuccess = '';
    if (!cpCurrent || !cpNew || !cpConfirm) { cpError = 'All fields are required'; return; }
    if (cpNew.length < 8) { cpError = 'New password must be at least 8 characters'; return; }
    if (cpNew !== cpConfirm) { cpError = 'Passwords do not match'; return; }
    cpSaving = true;
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) { cpError = data.error || 'Failed to change password'; return; }
      cpSuccess = 'Password changed successfully';
      cpCurrent = ''; cpNew = ''; cpConfirm = '';
      setTimeout(() => { showChangePassword = false; cpSuccess = ''; }, 1500);
    } catch (err: any) {
      cpError = err.message || 'Failed to change password';
    } finally {
      cpSaving = false;
    }
  }
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
      <button class="btn-change-pw" onclick={() => { showChangePassword = true; cpError = ''; cpSuccess = ''; }}>Change Password</button>
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
      <div class="error-message" role="alert">{error}</div>
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

{#if showChangePassword}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="cp-overlay" role="dialog" aria-modal="true" onclick={(e) => { if (e.target === e.currentTarget) showChangePassword = false }} onkeydown={(e) => { if (e.key === 'Escape') showChangePassword = false }}>
    <div class="cp-dialog">
      <h3>Change Password</h3>
      <input type="password" bind:value={cpCurrent} placeholder="Current password" class="cp-input" />
      <input type="password" bind:value={cpNew} placeholder="New password (min 8 chars)" class="cp-input" />
      <input type="password" bind:value={cpConfirm} placeholder="Confirm new password" class="cp-input" onkeydown={(e) => { if (e.key === 'Enter') handleChangePassword() }} />
      {#if cpError}<p class="cp-error">{cpError}</p>{/if}
      {#if cpSuccess}<p class="cp-success">{cpSuccess}</p>{/if}
      <div class="cp-actions">
        <button class="cp-cancel" onclick={() => { showChangePassword = false }}>Cancel</button>
        <button class="cp-submit" onclick={handleChangePassword} disabled={cpSaving}>{cpSaving ? 'Saving...' : 'Change'}</button>
      </div>
    </div>
  </div>
{/if}

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
    font-size: 1.75rem;
    font-weight: 700;
  }

  .brand-slide {
    color: var(--color-text, #1a1a2e);
  }
  .brand-wiz {
    color: #5a8fd4;
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

  .btn-change-pw {
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
  .btn-change-pw:hover { background: var(--color-bg-secondary); }

  .cp-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.4); display: flex;
    align-items: center; justify-content: center;
  }
  .cp-dialog {
    background: var(--color-bg, white); border-radius: var(--radius-md);
    padding: 1.5rem; width: 340px; max-width: 90vw;
    display: flex; flex-direction: column; gap: 0.75rem;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  .cp-dialog h3 { margin: 0; font-size: 1rem; font-family: var(--font-display); }
  .cp-input {
    padding: 8px 12px; border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); font-size: 0.875rem;
    outline: none; background: var(--color-bg); color: var(--color-text);
  }
  .cp-input:focus { border-color: var(--color-primary); }
  .cp-error { color: var(--color-error); font-size: 0.8rem; margin: 0; }
  .cp-success { color: var(--color-success); font-size: 0.8rem; margin: 0; }
  .cp-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .cp-cancel {
    padding: 6px 14px; font-size: 0.8125rem; border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); background: transparent;
    color: var(--color-text-secondary); cursor: pointer;
  }
  .cp-submit {
    padding: 6px 14px; font-size: 0.8125rem; font-weight: 600;
    border: none; border-radius: var(--radius-sm);
    background: var(--color-primary); color: white; cursor: pointer;
  }
  .cp-submit:disabled { opacity: 0.5; cursor: not-allowed; }

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
