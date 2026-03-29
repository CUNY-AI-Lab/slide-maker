<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { currentUser } from '$lib/stores/auth';
  import UserApprovalQueue from '$lib/components/admin/UserApprovalQueue.svelte';

  let user = $state<any>(null);
  let accessDenied = $state(false);
  let ready = $state(false);

  currentUser.subscribe((u) => {
    user = u;
  });

  onMount(() => {
    if (!user || user.role !== 'admin') {
      accessDenied = true;
    } else {
      ready = true;
    }
  });
</script>

<svelte:head>
  <title>Admin Dashboard</title>
</svelte:head>

{#if accessDenied}
  <div class="access-denied">
    <div class="denied-card">
      <h1>Access Denied</h1>
      <p>You do not have permission to view this page. Admin role is required.</p>
      <a href="{base}/" class="back-link">Back to Decks</a>
    </div>
  </div>
{:else if ready}
  <div class="admin-page">
    <header class="admin-header">
      <div class="header-left">
        <a href="{base}/" class="back-link">&larr; Back to Decks</a>
        <h1>Admin Dashboard</h1>
      </div>
    </header>

    <main class="admin-main">
      <UserApprovalQueue />
    </main>
  </div>
{/if}

<style>
  .access-denied {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    padding: 1rem;
  }

  .denied-card {
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    padding: 3rem;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    max-width: 400px;
  }

  .denied-card h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-error);
    margin-bottom: 0.75rem;
  }

  .denied-card p {
    font-size: 0.9375rem;
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .admin-page {
    min-height: 100vh;
    background: var(--color-bg-secondary);
  }

  .admin-header {
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 2rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .back-link {
    font-size: 0.8125rem;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .admin-header h1 {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-primary-dark);
  }

  .admin-main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
</style>
