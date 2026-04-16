<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';

  let token = $derived($page.url.searchParams.get('token') ?? '');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    success = '';

    if (!token) {
      error = 'Invalid reset link. Please request a new password reset.';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match.';
      return;
    }

    loading = true;

    try {
      const result = await api.resetPassword({ token, password });
      success = result.message;
      // Redirect to login after 3 seconds
      setTimeout(() => goto(`${base}/login`), 3000);
    } catch (err: any) {
      error = err.message || 'Failed to reset password. The link may have expired.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - CUNY AI Lab Slide Wiz</title>
</svelte:head>

<div class="auth-page">
  <form onsubmit={handleSubmit} class="auth-form">
    <div class="form-header">
      <h1>CUNY AI Lab</h1>
      <p>Set a new password</p>
    </div>

    <div class="form-body">
      {#if success}
        <div class="success-message" role="status">
          {success}
          <p class="redirect-note">Redirecting to sign in...</p>
        </div>
      {/if}

      {#if error}
        <div class="error-message" role="alert">{error}</div>
      {/if}

      {#if !token && !success}
        <div class="error-message" role="alert">
          Invalid reset link. Please <a href="{base}/forgot-password">request a new one</a>.
        </div>
      {:else if !success}
        <label class="field">
          <span>New Password</span>
          <input
            type="password"
            bind:value={password}
            placeholder="At least 8 characters"
            required
            minlength="8"
          />
        </label>

        <label class="field">
          <span>Confirm Password</span>
          <input
            type="password"
            bind:value={confirmPassword}
            placeholder="Enter password again"
            required
          />
        </label>

        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
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

  .error-message {
    background: #fef2f2;
    color: var(--color-error);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #fecaca;
  }

  .error-message a {
    color: var(--color-error);
    font-weight: 600;
    text-decoration: underline;
  }

  .success-message {
    background: #f0fdf4;
    color: #166534;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    border: 1px solid #bbf7d0;
  }

  .redirect-note {
    font-size: 0.8125rem;
    opacity: 0.8;
    margin-top: 0.5rem;
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
