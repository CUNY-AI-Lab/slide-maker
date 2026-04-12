<script lang="ts">
  import { onMount } from 'svelte'
  import { base } from '$app/paths'
  import { API_URL, api } from '$lib/api'
  import { currentUser } from '$lib/stores/auth'
  import { renderContent } from '$lib/utils/markdown'

  type StreamCard = {
    streamId: string
    userEmail: string
    deckId: string
    model: string
    provider: string
    startedAt: number
    systemPromptChars: number
    historyLength: number
    text: string
    chunkCount: number
    totalChars: number
    status: 'active' | 'done' | 'error'
    error?: string
    collapsed?: boolean
    fade?: boolean
  }

  interface Transcript {
    id: string; model: string; deckId: string; userMessage: string; assistantMessage: string
    timestamp: string; userEmail: string; durationMs: number; inputTokens: number; outputTokens: number
    error: string | null; provider: string; systemPromptChars: number; historyLength: number
    mutations: string[]; [key: string]: unknown
  }
  let { data } = $props<{ data: { transcripts: Transcript[] } }>()

  let user = $state<any>(null)
  let accessDenied = $state(false)
  let ready = $state(false)

  currentUser.subscribe((u) => { user = u })

  // Live streams indexed by id
  let streams = $state<Record<string, StreamCard>>({})
  let streamOrder = $state<string[]>([])
  let transcripts = $state<Transcript[]>(data?.transcripts ?? [])

  // Filters
  let filterModel = $state('')
  let filterDeck = $state('')
  let searchText = $state('')

  let eventSource: EventSource | null = $state(null)
  let lastRefresh = $state(0)

  const filteredTranscripts = $derived.by(() => {
    let arr = transcripts
    if (filterModel) arr = arr.filter((t) => t.model === filterModel)
    if (filterDeck) arr = arr.filter((t) => t.deckId === filterDeck)
    if (searchText) {
      const q = searchText.toLowerCase()
      arr = arr.filter((t) =>
        (t.userMessage || '').toLowerCase().includes(q) ||
        (t.assistantMessage || '').toLowerCase().includes(q),
      )
    }
    return arr
  })

  const activeCount = $derived.by(() => Object.values(streams).filter((s) => s.status === 'active').length)

  function ensureOrder(id: string) {
    if (!streamOrder.includes(id)) {
      streamOrder = [id, ...streamOrder]
    }
  }

  function connectSSE() {
    if (eventSource) { eventSource.close(); eventSource = null }
    try {
      eventSource = new EventSource(`${API_URL}/api/debug/stream`, { withCredentials: true })
    } catch (e) {
      console.error('Failed to connect SSE', e)
      return
    }

    eventSource.addEventListener('stream:start', (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data)
        const card: StreamCard = {
          streamId: d.streamId,
          userEmail: d.userEmail,
          deckId: d.deckId,
          model: d.model,
          provider: d.provider,
          startedAt: Date.parse(d.timestamp) || Date.now(),
          systemPromptChars: d.systemPromptChars,
          historyLength: d.historyLength,
          text: '',
          chunkCount: 0,
          totalChars: 0,
          status: 'active',
          collapsed: false,
          fade: false,
        }
        streams[d.streamId] = card
        ensureOrder(d.streamId)
      } catch {}
    })

    eventSource.addEventListener('stream:chunk', (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data)
        const s = streams[d.streamId]
        if (!s) return
        s.text += d.text
        s.chunkCount += 1
        s.totalChars += (d.text?.length || 0)
      } catch {}
    })

    eventSource.addEventListener('stream:done', (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data)
        const s = streams[d.streamId]
        if (!s) return
        s.status = 'done'
        s.fade = true
        // Auto-collapse after 30s
        setTimeout(() => { const i = streams[d.streamId]; if (i) i.collapsed = true }, 30_000)
        // Refresh transcripts
        refreshTranscripts()
      } catch {}
    })

    eventSource.addEventListener('stream:error', (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data)
        const s = streams[d.streamId]
        if (!s) return
        s.status = 'error'
        s.error = d.error
        s.fade = true
        setTimeout(() => { const i = streams[d.streamId]; if (i) i.collapsed = true }, 30_000)
        refreshTranscripts()
      } catch {}
    })
  }

  function tokensPerSec(s: StreamCard) {
    const elapsedSec = Math.max(0.25, (Date.now() - s.startedAt) / 1000)
    const tokens = Math.ceil((s.totalChars || 0) / 4)
    return (tokens / elapsedSec).toFixed(1)
  }

  function highlightedText(text: string): string {
    if (!text) return ''
    // Wrap ```mutation blocks with a span
    return text
      .replace(/```\s*mutation\s*\n([\s\S]*?)```/gi, (_m, inner) => `<span class="mutation-block">${escapeHtml(inner)}</span>`)
      .replace(/\n/g, '<br>')
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  async function refreshTranscripts() {
    // Avoid spamming the API
    const now = Date.now()
    if (now - lastRefresh < 1000) return
    lastRefresh = now
    try {
      const res = await api.listTranscripts({ limit: 50, deck: filterDeck || undefined, model: filterModel || undefined })
      transcripts = res.transcripts || []
    } catch {}
  }

  function clearCompleted() {
    const actives: Record<string, StreamCard> = {}
    const order: string[] = []
    for (const id of streamOrder) {
      const s = streams[id]
      if (s && s.status === 'active') { actives[id] = s; order.push(id) }
    }
    streams = actives
    streamOrder = order
  }

  async function clearLog() {
    try {
      await api.clearTranscripts()
      transcripts = []
    } catch {}
  }

  onMount(() => {
    if (!user || user.role !== 'admin') {
      accessDenied = true
      return
    }
    ready = true
    connectSSE()
    const t = setInterval(() => { if (document.visibilityState === 'visible') refreshTranscripts() }, 5000)
    return () => { eventSource?.close(); clearInterval(t) }
  })
</script>

<svelte:head>
  <title>LLM Debug Dashboard</title>
</svelte:head>

{#if accessDenied}
  <div class="access-denied">
    <div class="denied-card">
      <h1>Access Denied</h1>
      <p>Admin role required to view this page.</p>
      <a href="{base}/" class="back-link">Back to Decks</a>
    </div>
  </div>
{:else if ready}
  <div class="debug-page">
    <header class="debug-header">
      <div class="left">
        <a href="{base}/" class="back-link">&larr; Back</a>
        <h1>LLM Debug Dashboard</h1>
      </div>
      <div class="actions">
        <button class="ghost" onclick={clearCompleted} title="Clear completed">Clear Completed</button>
      </div>
    </header>

    <div class="panels">
      <section class="panel">
        <h2>Live Streams</h2>
        {#if activeCount === 0}
          <div class="empty">Waiting for chat requests...</div>
        {/if}
        <div class="streams">
          {#each streamOrder as id}
            {#if streams[id]}
              {@const s = streams[id]}
              <button type="button" class="stream-card {s.fade ? 'fade' : ''} {s.collapsed ? 'collapsed' : ''}" onclick={() => s.collapsed = !s.collapsed}>
                <div class="header">
                  <span class="badge">{s.model}</span>
                  <span class="meta">{s.userEmail}</span>
                  <span class="meta">Deck: {s.deckId}</span>
                  <span class="meta">{((Date.now() - s.startedAt) / 1000).toFixed(1)}s</span>
                  {#if s.status === 'error'}<span class="error">Error</span>{/if}
                </div>
                <div class="metrics">
                  <span>{Math.ceil(s.totalChars / 4)} tok</span>
                  <span>{s.chunkCount} chunks</span>
                  <span>{tokensPerSec(s)} tok/s</span>
                </div>
                <div class="body" aria-live="polite">
                  {@html highlightedText(s.text)}
                </div>
              </button>
            {/if}
          {/each}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Transcript Log</h2>
          <div class="filters">
            <select bind:value={filterModel} onchange={refreshTranscripts} aria-label="Filter by model">
              <option value="">All Models</option>
              {#each Array.from(new Set(transcripts.map((t) => t.model))) as m}
                <option value={m}>{m}</option>
              {/each}
            </select>
            <input placeholder="Deck ID" bind:value={filterDeck} onblur={refreshTranscripts} />
            <input placeholder="Search text" bind:value={searchText} />
            <button class="ghost" onclick={clearLog} title="Clear Log">Clear Log</button>
          </div>
        </div>
        <div class="table">
          <div class="thead">
            <div>Timestamp</div>
            <div>Model</div>
            <div>User</div>
            <div>Duration</div>
            <div>Tokens (in/out)</div>
            <div>Status</div>
          </div>
          {#each filteredTranscripts as t (t.id)}
            <details class="row">
              <summary>
                <div>{new Date(t.timestamp).toLocaleString()}</div>
                <div>{t.model}</div>
                <div>{t.userEmail}</div>
                <div>{(t.durationMs/1000).toFixed(1)}s</div>
                <div>{t.inputTokens}/{t.outputTokens}</div>
                <div>{t.error ? 'error' : 'success'}</div>
              </summary>
              <div class="detail">
                <div class="kv"><strong>Deck:</strong> <code>{t.deckId}</code></div>
                <div class="kv"><strong>Provider:</strong> {t.provider}</div>
                <div class="kv"><strong>System chars:</strong> {t.systemPromptChars} — <strong>History:</strong> {t.historyLength}</div>
                {#if t.error}<div class="error">{t.error}</div>{/if}
                <h3>User Message</h3>
                <pre class="plain">{t.userMessage}</pre>
                <h3>Assistant</h3>
                <div class="assistant" >{@html renderContent(t.assistantMessage || '')}</div>
                {#if t.mutations?.length}
                  <h3>Mutations</h3>
                  <ul class="mutations">
                    {#each t.mutations as m}
                      <li><pre class="plain">{m}</pre></li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </details>
          {/each}
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .access-denied { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-bg-secondary); }
  .denied-card { background: var(--color-bg); border-radius: var(--radius-lg); padding: 2rem; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .denied-card h1 { color: var(--color-error); font-size: 1.25rem; margin: 0 0 .5rem; }
  .back-link { color: var(--color-primary); text-decoration: none; font-weight: 500; }
  .back-link:hover { text-decoration: underline; }

  .debug-page { min-height: 100vh; background: var(--color-bg-secondary); }
  .debug-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); padding: .75rem 1rem; }
  .debug-header .left { display: flex; align-items: center; gap: 1rem; }
  .debug-header h1 { font-family: var(--font-display); font-size: 1.1rem; margin: 0; }
  .ghost { border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; }
  .ghost:hover { background: var(--color-ghost-bg); color: var(--color-primary); border-color: var(--color-primary); }

  .panels { max-width: 1200px; margin: 0 auto; padding: 1rem; display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 1100px) { .panels { grid-template-columns: 1fr 1fr; align-items: start; } }
  .panel { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: .75rem; }
  .panel h2 { margin: 0 0 .5rem; font-size: .95rem; color: var(--color-primary-dark); }

  .streams { display: flex; flex-direction: column; gap: 8px; }
  .stream-card { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px; cursor: pointer; background: var(--color-bg); text-align: left; }
  .stream-card.fade { opacity: .6; }
  .stream-card.collapsed .body { display: none; }
  .header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .badge { background: var(--color-ghost-bg); border: 1px solid var(--color-border); padding: 2px 6px; border-radius: 999px; font-size: 11px; }
  .meta { color: var(--color-text-muted); font-size: 12px; }
  .error { color: var(--color-error); font-weight: 600; font-size: 12px; }
  .metrics { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-secondary); margin: 4px 0; }
  .body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.5; max-height: 220px; overflow: auto; padding: 6px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); }
  .empty { color: var(--color-text-muted); font-size: 13px; padding: 8px; }

  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .filters { display: flex; gap: 6px; align-items: center; }
  .filters input, .filters select { font-size: 12px; padding: 4px 6px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); border-radius: var(--radius-sm); }

  .table { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
  .thead, .row > summary { display: grid; grid-template-columns: 1.5fr 1fr 1.2fr .7fr 1fr .7fr; gap: 8px; align-items: center; padding: 8px; border-bottom: 1px solid var(--color-border); font-size: 12px; }
  .thead { background: var(--color-ghost-bg); color: var(--color-text-secondary); font-weight: 600; }
  .row { border-bottom: 1px solid var(--color-border); }
  .row > summary { list-style: none; cursor: pointer; }
  .row > summary::-webkit-details-marker { display: none; }
  .detail { padding: 10px; background: var(--color-bg-secondary); font-size: 12px; }
  .assistant { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px; background: var(--color-bg); }
  .mutations { margin: 6px 0; padding-left: 18px; }
  .plain { white-space: pre-wrap; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 6px; }
  .kv { margin: 4px 0; color: var(--color-text-secondary); }
</style>
