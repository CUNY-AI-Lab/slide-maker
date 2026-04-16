<script lang="ts">
  import { api } from '$lib/api';
  import { base } from '$app/paths';

  let email = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    success = '';
    loading = true;

    try {
      const result = await api.forgotPassword(email);
      success = result.message;
      email = '';
    } catch (err: any) {
      error = err.message || 'Something went wrong. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - CUNY AI Lab Slide Wiz</title>
</svelte:head>

<div class="auth-page">
  <form onsubmit={handleSubmit} class="auth-form">
    <div class="form-header">
      <h1>CUNY AI Lab</h1>
      <p>Reset your password</p>
    </div>

    <div class="form-body">
      {#if success}
        <div class="success-message" role="status">{success}</div>
      {/if}

      {#if error}
        <div class="error-message" role="alert">{error}</div>
      {/if}

      {#if !success}
        <p class="instructions">Enter your email address and we'll send you a link to reset your password.</p>

        <label class="field">
          <span>Email</span>
          <input
            type="email"
            bind:value={email}
            placeholder="you@cuny.edu"
            required
          />
        </label>

        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      {/if}

      <p class="form-footer">
        <a href="{base}/login">Back to Sign In</a>
      </p>
    </div>
  </form>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    padding: 1rem;
  }

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
    font-size: 1.125rem;
    opacity: 0.85;
  }

  .form-body {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .instructions {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .error-message {
    background: #fef2f2;
    color: var(--color-error);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #fecaca;
  }

  .success-message {
    background: #f0fdf4;
    color: #166534;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #bbf7d0;
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
