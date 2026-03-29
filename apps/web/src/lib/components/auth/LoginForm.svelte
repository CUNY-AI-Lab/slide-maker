<script lang="ts">
  import { api } from '$lib/api';
  import { currentUser } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const { user } = await api.login({ email, password });
      currentUser.set(user);
      goto(`${base}/`);
    } catch (err: any) {
      error = err.message || 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="auth-form">
  <div class="form-header">
    <h1>CUNY AI Lab</h1>
    <p>Sign in to <span class="brand-slide">Slide</span> <span class="brand-wiz">Wiz</span></p>
  </div>

  <div class="form-body">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <label class="field">
      <span>Email</span>
      <input
        type="email"
        bind:value={email}
        placeholder="you@cuny.edu"
        required
      />
    </label>

    <label class="field">
      <span>Password</span>
      <input
        type="password"
        bind:value={password}
        placeholder="Enter your password"
        required
      />
    </label>

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? 'Signing in...' : 'Sign In'}
    </button>

    <p class="form-footer">
      Don't have an account? <a href="{base}/register">Register</a>
    </p>
  </div>
</form>

<style>
  .auth-form {
    width: 100%;
    max-width: 420px;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .form-header {
    background: var(--color-primary-dark);
    color: white;
    padding: 2rem;
    text-align: center;
  }

  .form-header h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .form-header p {
    font-size: 0.875rem;
    opacity: 0.85;
  }

  .brand-slide {
    color: #1a1a2e;
    font-weight: 700;
  }
  .brand-wiz {
    color: #1D3A83;
    font-weight: 700;
  }

  .form-body {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .error-message {
    background: #fef2f2;
    color: var(--color-error);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #fecaca;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field span {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .field input {
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-family: var(--font-body);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .field input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px rgba(59, 115, 230, 0.15);
  }

  .btn-primary {
    padding: 0.75rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-full);
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-footer {
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .form-footer a {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .form-footer a:hover {
    text-decoration: underline;
  }
</style>
