<script lang="ts">
  import { API_URL } from '$lib/api'
  import { chatStreaming } from '$lib/stores/chat'

  let remaining = $state<number | null>(null)
  let loading = $state(false)

  $effect(() => {
    if ($chatStreaming) return
    const controller = new AbortController()
    loading = true
    fetch(`${API_URL}/api/providers/quota`, { credentials: 'include', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Quota unavailable')
        const quota = await response.json()
        if (quota.state !== 'estimated' || typeof quota.remaining_percent !== 'number' || !Number.isFinite(quota.remaining_percent)) throw new Error('Invalid quota')
        if (!controller.signal.aborted) remaining = quota.remaining_percent
      })
      .catch(() => { if (!controller.signal.aborted) remaining = null })
      .finally(() => { if (!controller.signal.aborted) loading = false })
    return () => controller.abort()
  })
</script>

<p class="quota" aria-live="polite">
  {#if loading}
    Loading quota estimate…
  {:else if remaining === null}
    Quota estimate unavailable
  {:else}
    Estimated quota remaining: {remaining.toFixed(0)}%
  {/if}
</p>

<style>
  .quota { margin: 4px 0 0; font-size: 11px; color: var(--color-text-muted); }
</style>
