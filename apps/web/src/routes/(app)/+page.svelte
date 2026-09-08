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
    const institutional = $currentUser?.authentication === 'institutional';
    currentUser.set(null);
    if (institutional) {
      window.location.assign('/auth/logout');
      return;
    }
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
      <h1><span class="brand-slide">Slide</span><span class="brand-wiz">Wiz</span></h1>
    </div>
    <div class="header-right">
      {#if user}
        <span class="user-name">{user.name}</span>
        {#if user.role === 'admin'}
          <a href="{base}/admin" class="header-link">Admin</a>
        {/if}
      {/if}
      {#if user?.authentication !== 'institutional'}
        <button class="header-link" onclick={() => { showChangePassword = true; cpError = ''; cpSuccess = ''; }}>Password</button>
      {/if}
      <button class="header-link btn-logout" onclick={handleLogout}>Sign Out</button>
      <button class="btn-new" onclick={() => (showNewDeck = true)} type="button">
        + New Deck
      </button>
    </div>
  </header>

  <main class="gallery-main">
    {#if error}
      <div class="error-message" role="alert">{error}</div>
    {/if}

    <div class="section-header">
      <h2 class="section-title">My Decks</h2>
      {#if !loading}
        <span class="deck-count">{decks.length} {decks.length === 1 ? 'deck' : 'decks'}</span>
      {/if}
    </div>

    {#if loading}
      <div class="skeleton-grid" aria-label="Loading decks..." aria-busy="true">
        {#each [0, 1, 2, 3, 4, 5] as i}
          <div class="skeleton-card" style="animation-delay: {i * 60}ms">
            <div class="skeleton-preview"></div>
            <div class="skeleton-body">
              <div class="skeleton-line skeleton-title"></div>
              <div class="skeleton-line skeleton-meta"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <DeckGrid
        {decks}
        ondelete={handleDelete}
        onshare={(id) => (sharingDeckId = id)}
        oncreate={() => (showNewDeck = true)}
      />
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

  /* ── Header ─────────────────────────────────── */
  .gallery-header {
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 0 2rem;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-left h1 {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .brand-slide {
    color: var(--color-text);
  }

  .brand-wiz {
    color: var(--color-primary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-name {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    font-weight: 500;
    padding-right: 0.5rem;
  }

  .header-link {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 0.375rem 0.625rem;
    cursor: pointer;
    font-family: var(--font-body);
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
    display: inline-flex;
    align-items: center;
  }

  .header-link:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
  }

  .btn-logout {
    color: var(--color-text-muted);
  }

  .btn-new {
    padding: 0.5rem 1.125rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.15s;
    margin-left: 0.25rem;
  }

  .btn-new:hover {
    background: var(--color-primary-hover);
  }

  /* ── Main ─────────────────────────────────── */
  .gallery-main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 2rem 3rem;
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .deck-count {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    font-weight: 400;
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

  /* ── Skeleton loading ─────────────────────── */
  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .skeleton-card {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    animation: skeleton-fade 0.4s ease both;
  }

  @keyframes skeleton-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .skeleton-preview {
    height: 160px;
    background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s infinite;
  }

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .skeleton-body {
    padding: 0.875rem 1rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .skeleton-line {
    border-radius: 4px;
    background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s infinite;
  }

  .skeleton-title {
    height: 14px;
    width: 65%;
  }

  .skeleton-meta {
    height: 11px;
    width: 40%;
  }

  /* ── Change password dialog ───────────────── */
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
    font-family: var(--font-body);
  }

  .cp-input:focus { border-color: var(--color-primary); }
  .cp-error { color: var(--color-error); font-size: 0.8rem; margin: 0; }
  .cp-success { color: var(--color-success); font-size: 0.8rem; margin: 0; }
  .cp-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

  .cp-cancel {
    padding: 6px 14px; font-size: 0.8125rem; border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); background: transparent;
    color: var(--color-text-secondary); cursor: pointer; font-family: var(--font-body);
  }

  .cp-submit {
    padding: 6px 14px; font-size: 0.8125rem; font-weight: 600;
    border: none; border-radius: var(--radius-sm);
    background: var(--color-primary); color: white; cursor: pointer;
    font-family: var(--font-body);
  }

  .cp-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
