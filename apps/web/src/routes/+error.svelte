<script>
  import { page } from '$app/stores'
  import { base } from '$app/paths'
</script>

<svelte:head>
  <title>Error {$page.status} — Slide Wiz</title>
</svelte:head>

<div class="error-page">
  <div class="error-card">
    <h1>{$page.status}</h1>
    <p>{$page.error?.message || 'Something went wrong'}</p>
    <a href="{base}/" class="back-link">Back to Dashboard</a>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    max-width: 420px;
    padding: 2.5rem;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
  }

  h1 {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 700;
    color: var(--color-primary-dark);
    margin: 0 0 0.5rem;
  }

  p {
    font-family: var(--font-body);
    color: var(--color-text-secondary);
    margin: 0 0 1.5rem;
    font-size: 1.05rem;
  }

  .back-link {
    display: inline-block;
    padding: 0.6rem 1.5rem;
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-weight: 500;
    font-family: var(--font-body);
    transition: background 0.15s;
  }

  .back-link:hover {
    background: var(--color-ghost-bg-hover);
  }
</style>
