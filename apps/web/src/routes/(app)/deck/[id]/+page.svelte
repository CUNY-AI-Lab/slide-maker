<script lang="ts">
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { currentDeck } from '$lib/stores/deck';
  import { activeSlideId } from '$lib/stores/ui';
  import { chatMessages } from '$lib/stores/chat';
  import { undo, redo } from '$lib/utils/mutations';
  import EditorShell from '$lib/components/editor/EditorShell.svelte';

  let loading = $state(true);
  let error = $state('');
  let readOnly = $state(false);
  let lockedByName = $state('');
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let deckId = '';

  async function releaseLockQuietly() {
    try {
      await api.releaseLock(deckId);
    } catch {
      // best effort
    }
  }

  function handleKeyboard(e: KeyboardEvent) {
    const isMac = navigator.platform.includes('Mac')
    const mod = isMac ? e.metaKey : e.ctrlKey
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    } else if (mod && e.key === 'z' && e.shiftKey) {
      e.preventDefault()
      redo()
    } else if (mod && e.key === 'y') {
      e.preventDefault()
      redo()
    }
  }

  function handleBeforeUnload() {
    if (!readOnly && deckId) {
      // Use sendBeacon for reliable unload
      const url = `${import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'}/api/decks/${deckId}/lock`;
      navigator.sendBeacon?.(url); // sendBeacon only does POST, so we also try fetch
      fetch(url, { method: 'DELETE', credentials: 'include', keepalive: true }).catch(() => {});
    }
  }

  onMount(async () => {
    deckId = $page.params.id ?? '';
    try {
      const res = await api.getDeck(deckId);
      currentDeck.set(res.deck ?? res);
      const deck = res.deck ?? res;
      if (deck.slides?.length > 0) {
        activeSlideId.set(deck.slides[0].id);
      }

      // Load chat history
      try {
        const historyRes = await api.getChatHistory(deckId);
        if (historyRes?.messages?.length) {
          chatMessages.set(historyRes.messages.map((m: any, i: number) => ({
            id: `hist-${i}`,
            role: m.role,
            content: m.content,
            streaming: false,
          })));
        }
      } catch {
        // Non-critical — chat works without history
      }

      // Try to acquire lock
      try {
        const lockRes = await api.acquireLock(deckId);
        if (!lockRes.locked) {
          readOnly = true;
          lockedByName = lockRes.lockedBy?.name ?? 'another user';
        } else {
          // Start heartbeat every 2 minutes
          heartbeatInterval = setInterval(() => {
            api.refreshLock(deckId).catch(() => {});
          }, 2 * 60 * 1000);
        }
      } catch {
        // If lock endpoint fails entirely, allow editing (graceful degradation)
      }

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('keydown', handleKeyboard);
    } catch (err: any) {
      error = err.message || 'Failed to load deck';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    chatMessages.set([]);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('keydown', handleKeyboard);
    if (!readOnly && deckId) {
      releaseLockQuietly();
    }
  });
</script>

<svelte:head>
  <title>Editor - CUNY AI Lab Slide Maker</title>
</svelte:head>

{#if loading}
  <div class="loading">
    <p>Loading deck...</p>
  </div>
{:else if error}
  <div class="error">
    <p>{error}</p>
    <a href="{base}/">Back to decks</a>
  </div>
{:else}
  {#if readOnly}
    <div class="lock-banner">
      This deck is being edited by {lockedByName}. You are in read-only mode.
    </div>
  {/if}
  <EditorShell editable={!readOnly} />
{/if}

<style>
  .loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .error {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--color-error);
    font-size: 0.9375rem;
  }

  .error a {
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .error a:hover {
    text-decoration: underline;
  }

  .lock-banner {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #fef3cd;
    color: #856404;
    text-align: center;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-family: var(--font-body);
    border-bottom: 1px solid #ffc107;
  }
</style>
