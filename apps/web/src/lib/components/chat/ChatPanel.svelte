<script lang="ts">
  import { get } from 'svelte/store'
  import { api } from '$lib/api'
  import ChatMessage from './ChatMessage.svelte'
  import ModelSelector from './ModelSelector.svelte'
  import ChatInput from './ChatInput.svelte'
  import {
    chatMessages,
    chatStreaming,
    selectedModelId,
    addUserMessage,
    addAssistantMessage,
    appendToAssistant,
    finishAssistant,
    type ChatMsg,
  } from '$lib/stores/chat'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { consumeActions, lastAgentSlideId } from '$lib/stores/actions'
  import { getRecentRenderDiagnostics } from '$lib/stores/render-diagnostics'
  import { pendingMutations, autoApply, addPendingMutation, acceptMutation, rejectMutation } from '$lib/stores/pending-mutations'
  import { streamChat } from '$lib/utils/sse'
  import { extractMutations, applyMutation } from '$lib/utils/mutations'

  let { onCollapse }: { onCollapse?: () => void } = $props()

  let messagesContainer: HTMLDivElement | undefined = $state()
  const latestAssistantId = $derived(
    [...$chatMessages].reverse().find((m) => m.role === 'assistant' && !m.streaming)?.id ?? null
  )
  let clearing = $state(false)
  let controller: AbortController | null = $state(null)
  let currentAssistantId: string | null = $state(null)

  // Auto-scroll to bottom when messages change
  $effect(() => {
    // Track messages length to trigger scroll
    const _len = $chatMessages.length
    const _lastContent = $chatMessages.at(-1)?.content?.length
    if (messagesContainer) {
      // Use a microtask to scroll after DOM update
      queueMicrotask(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      })
    }
  })

  async function handleSend(text: string) {
    const deck = get(currentDeck)
    if (!deck) return

    // Handle /search command
    const trimmed = text.trim()
    if (trimmed.startsWith('/search ')) {
      const query = trimmed.slice(8).trim()
      if (!query) return
      addUserMessage(text)
      const searchMsgId = addAssistantMessage()
      appendToAssistant(searchMsgId, 'Searching the web...')

      try {
        // Tavily for text results — don't let failure block image search
        let results: { answer?: string; results: any[]; images: string[] } = { results: [], images: [] }
        try {
          results = await api.webSearch(query)
        } catch {
          // Tavily may be down — continue with Pexels image search
        }
        let response = `**Search results for "${query}":**\n\n`

        // Search Pexels for openly licensed images
        try {
          const imgResults = await api.searchImages(query, 3)
          const pexelsImages = imgResults.images ?? []

          if (pexelsImages.length) {
            const sanitized = query.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)
            const downloads = await Promise.allSettled(
              pexelsImages.map((img, i) =>
                api.downloadImage(img.url, deck.id, `search-${sanitized}-${i + 1}.jpg`)
              )
            )
            const successful = downloads
              .filter((d): d is PromiseFulfilledResult<any> => d.status === 'fulfilled' && !!d.value?.file)
              .map(d => d.value)

            if (successful.length) {
              response += `**Images downloaded (${successful.length})** (via Pexels, free to use):\n`
              successful.forEach((d: any) => {
                response += `- "${d.file.filename}" → ${d.file.url}\n`
              })
              // Auto-insert first image into active slide
              const slideId = get(activeSlideId)
              if (slideId) {
                // Store relative path — ImageModule.svelte prepends API_URL at render time
                await applyMutation({
                  action: 'addBlock',
                  payload: {
                    slideId,
                    block: {
                      type: 'image',
                      zone: 'stage',
                      data: { src: successful[0].file.url, alt: query, caption: '' },
                    },
                  },
                })
                response += `\nFirst image added to the active slide.\n`
              }
            }
          }
        } catch {
          response += `\nImage search unavailable.\n`
        }

        if (results.answer) {
          response += `\n**Answer:** ${results.answer}\n`
        }

        if (results.results?.length) {
          response += `\n**Sources:**\n`
          results.results.slice(0, 3).forEach((r: any) => {
            response += `- [${r.title}](${r.url})\n`
          })
        }

        chatMessages.update((msgs) =>
          msgs.map((m) => m.id === searchMsgId ? { ...m, content: response, streaming: false } : m)
        )

        // Persist search results to DB so AI sees them in future turns
        api.saveChatMessages(deck.id, [
          { role: 'user', content: text },
          { role: 'assistant', content: response },
        ]).catch(err => console.error('Failed to persist search:', err))
      } catch (err: any) {
        chatMessages.update((msgs) =>
          msgs.map((m) => m.id === searchMsgId ? { ...m, content: `Search failed: ${err.message}`, streaming: false } : m)
        )
      }
      return
    }

    const modelId = get(selectedModelId)
    const slideId = get(activeSlideId)
    const hasSlides = (deck.slides?.length ?? 0) > 0
    // Guard: require an active slide only if the deck already has slides
    if (!slideId && hasSlides) return

    // Add user message
    addUserMessage(text)

    // Create streaming assistant message
    const assistantId = addAssistantMessage()
    currentAssistantId = assistantId
    appendToAssistant(assistantId, 'Thinking...')
    chatStreaming.set(true)

    // Prepare abort controller for hanging/stop behavior
    controller?.abort()
    controller = new AbortController()
    const abortSignal = controller.signal
    const hardTimeout = setTimeout(() => { controller?.abort() }, 115_000)

    let fullText = ''
    let firstChunk = true
    let appliedMutationCount = 0

    // Serial mutation queue — prevents race conditions when rapid-fire mutations
    // (e.g. addBlock then reorderBlocks) overlap and hit the API out of order
    const mutationQueue: Record<string, unknown>[] = []
    let processingQueue = false
    let aborted = false
    let queueIdle: Promise<void> = Promise.resolve()

  async function drainQueue() {
    if (processingQueue) return
    processingQueue = true
    queueIdle = (async () => {
      while (mutationQueue.length > 0 && !aborted) {
        const mut = mutationQueue.shift()!
        try {
          await applyMutation(mut)
        } catch (err) {
          console.error('Failed to apply mutation:', err, mut)
        }
      }
      processingQueue = false
    })()
    await queueIdle
  }

    // Snapshot autoApply at stream start — don't let mid-stream toggles split mutations
    const liveApply = get(autoApply)

    // Consume action buffer for AI context
    const actions = consumeActions()
    const agentSlideId = get(lastAgentSlideId)
    const recentRenderDiagnostics = getRecentRenderDiagnostics()

    // Build history from existing messages (exclude the streaming placeholder)
    const history = get(chatMessages)
      .filter((m) => m.id !== assistantId && !m.streaming)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    await streamChat(
      text,
      deck.id,
      slideId,
      modelId,
      history,
      recentRenderDiagnostics,
      (chunk) => {
        if (firstChunk) {
          // Replace "Thinking..." with first real content
          chatMessages.update((msgs) =>
            msgs.map((m) => m.id === assistantId ? { ...m, content: chunk } : m)
          )
          firstChunk = false
        } else {
          appendToAssistant(assistantId, chunk)
        }
        fullText += chunk

        // Extract and handle mutations as they stream in
        const mutations = extractMutations(fullText)
        while (appliedMutationCount < mutations.length) {
          const mut = mutations[appliedMutationCount]
          if (liveApply) {
            if (isRiskyMutation(mut)) {
              addPendingMutation(assistantId, mut)
            } else {
              mutationQueue.push(mut)
              drainQueue()
            }
          } else {
            addPendingMutation(assistantId, mut)
          }
          appliedMutationCount++
        }
      },
      async () => {
        await queueIdle
        finishAssistant(assistantId)
        chatStreaming.set(false)
        clearTimeout(hardTimeout)
        currentAssistantId = null
        controller = null
      },
      (error) => {
        aborted = true
        mutationQueue.length = 0
        appendToAssistant(assistantId, `\n\n[Error: ${error}]`)
        finishAssistant(assistantId)
        chatStreaming.set(false)
        clearTimeout(hardTimeout)
        currentAssistantId = null
        controller = null
      },
      abortSignal,
      actions,
      agentSlideId,
    )
  }

  function isRiskyMutation(m: any): boolean {
    const action = m?.action
    if (!action) return true
    // Destructive or deck-wide changes require approval
    if (action === 'removeSlide' || action === 'reorderSlides' || action === 'setTheme') return true
    if (action === 'applyTemplate') {
      // Replacing an existing slide is riskier than creating a new one
      return Boolean(m?.payload?.slideId)
    }
    if (action === 'removeBlock') return true
    return false
  }

  function stopStreaming() {
    if (!controller || !$chatStreaming) return
    controller.abort()
    if (currentAssistantId) finishAssistant(currentAssistantId)
    chatStreaming.set(false)
    currentAssistantId = null
    controller = null
  }

  async function handleAcceptMutation(id: string) {
    const list = get(pendingMutations)
    const pm = list.find((p) => p.id === id)
    if (!pm || pm.status !== 'pending') return
    try {
      await applyMutation(pm.mutation)
      acceptMutation(id)
    } catch (err) {
      console.error('Mutation apply failed, keeping as pending:', err)
    }
  }

  function handleRejectMutation(id: string) {
    rejectMutation(id)
  }

  async function handleAcceptAll() {
    const list = get(pendingMutations).filter((p) => p.status === 'pending')
    for (const pm of list) {
      try {
        await applyMutation(pm.mutation)
        acceptMutation(pm.id)
      } catch (err) {
        console.error('Mutation apply failed during accept-all, stopping:', err)
        break
      }
    }
  }

  const hasPending = $derived($pendingMutations.some((p) => p.status === 'pending'))

  async function resetChat() {
    if (clearing) return
    const deck = get(currentDeck)
    if (!deck) return
    if ($chatStreaming) return
    try {
      clearing = true
      await api.resetChatHistory(deck.id)
      chatMessages.set([])
      pendingMutations.set([])
    } catch (err) {
      console.error('Failed to reset chat:', err)
    } finally {
      clearing = false
    }
  }
</script>

<div class="chat-panel">
  <div class="chat-header">
    <div class="chat-controls">
      <ModelSelector />
      {#if $chatStreaming}
        <button class="stop-btn" title="Stop response" onclick={stopStreaming} aria-label="Stop streaming">Stop</button>
      {/if}
      <label class="auto-apply-toggle" title="Auto-apply mutations during streaming">
        <input type="checkbox" bind:checked={$autoApply} />
        <span>Auto</span>
      </label>
      {#if hasPending}
        <button class="accept-all-btn" onclick={handleAcceptAll}>Accept All</button>
      {/if}
      <div class="reset-wrap" style="margin-left: auto;">
        <button
          class="reset-btn"
          title={$chatStreaming ? 'Wait for response to finish' : 'Reset chat'}
          onclick={resetChat}
          disabled={clearing || $chatStreaming}
          aria-label="Reset chat"
        >
          {clearing ? '...' : 'Reset'}
        </button>
      </div>
      {#if onCollapse}
        <button class="collapse-toggle" onclick={onCollapse} title="Collapse chat" aria-label="Collapse chat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="messages" bind:this={messagesContainer} aria-live="polite">
    {#if $chatMessages.length === 0}
      <div class="empty-state">
        <p>Start a conversation to create your deck.</p>
      </div>
    {:else}
      {#each $chatMessages as msg (msg.id)}
        <ChatMessage
          message={msg}
          onsuggest={handleSend}
          mutations={$pendingMutations.filter((pm) => pm.messageId === msg.id)}
          onaccept={handleAcceptMutation}
          onreject={handleRejectMutation}
          isLatestAssistant={msg.id === latestAssistantId}
        />
      {/each}
    {/if}
  </div>

  <ChatInput onsend={handleSend} />
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .chat-header {
    flex-shrink: 0;
  }

  .chat-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .collapse-toggle:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .reset-wrap { position: relative; }

  .stop-btn {
    padding: 3px 8px;
    font-size: 11px;
    border: 1px solid #ef4444;
    border-radius: var(--radius-sm);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    transition: background 0.15s;
  }
  .stop-btn:hover {
    background: rgba(239, 68, 68, 0.08);
  }

  .reset-btn {
    padding: 3px 8px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .reset-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .auto-apply-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
  }
  .auto-apply-toggle input {
    width: 12px;
    height: 12px;
    margin: 0;
    accent-color: var(--color-primary, #3B73E6);
  }

  .accept-all-btn {
    padding: 3px 8px;
    font-size: 10px;
    border: 1px solid var(--color-success-accent);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-success-accent);
    cursor: pointer;
    transition: background 0.15s;
  }
  .accept-all-btn:hover {
    background: color-mix(in srgb, var(--color-success-accent) 10%, transparent);
  }

  /* Confirmation UI removed: reset is one-click by design */

  .messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;
  }

  .empty-state p {
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

</style>
