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
  import { streamChat } from '$lib/utils/sse'
  import { extractMutations, applyMutation } from '$lib/utils/mutations'

  let { onCollapse }: { onCollapse?: () => void } = $props()

  let messagesContainer: HTMLDivElement | undefined = $state()
  let messages = $state<ChatMsg[]>([])
  let clearing = $state(false)
  let controller: AbortController | null = $state(null)
  let currentAssistantId: string | null = $state(null)

  // Subscribe to store
  $effect(() => {
    const unsub = chatMessages.subscribe((v) => {
      messages = v
    })
    return unsub
  })

  // Auto-scroll to bottom when messages change
  $effect(() => {
    // Track messages length to trigger scroll
    const _len = messages.length
    const _lastContent = messages.at(-1)?.content?.length
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
        const results = await api.webSearch(query)
        let response = `**Search results for "${query}":**\n\n`

        if (results.images?.length) {
          response += `**Images found (${results.images.length}):**\n`
          // Auto-download first image and add to slide
          const imgUrl = results.images[0]
          try {
            const downloaded = await api.downloadImage(imgUrl, deck.id, `${query.replace(/\s+/g, '-').slice(0, 30)}.jpg`)
            if (downloaded?.file) {
              const slideId = get(activeSlideId)
              if (slideId) {
                const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001'
                await applyMutation({
                  action: 'addBlock',
                  payload: {
                    slideId,
                    block: {
                      type: 'image',
                      zone: 'stage',
                      data: { src: `${API_URL}${downloaded.file.url}`, alt: query, caption: '' },
                    },
                  },
                })
                response += `\nImage downloaded and added to the active slide.\n`
              } else {
                response += `\nImage downloaded to Files. Select a slide to insert it.\n`
              }
            }
          } catch {
            response += `\nCouldn't download the image automatically. Here are the URLs:\n`
            results.images.slice(0, 3).forEach((img: string, i: number) => {
              response += `${i + 1}. ${img}\n`
            })
          }
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

        // Apply mutations live as they stream in
        const mutations = extractMutations(fullText)
        while (appliedMutationCount < mutations.length) {
          applyMutation(mutations[appliedMutationCount]).catch((err) =>
            console.error('Failed to apply mutation:', err, mutations[appliedMutationCount])
          )
          appliedMutationCount++
        }
      },
      async () => {
        finishAssistant(assistantId)
        chatStreaming.set(false)
        clearTimeout(hardTimeout)
        currentAssistantId = null
        controller = null
      },
      (error) => {
        appendToAssistant(assistantId, `\n\n[Error: ${error}]`)
        finishAssistant(assistantId)
        chatStreaming.set(false)
        clearTimeout(hardTimeout)
        currentAssistantId = null
        controller = null
      },
      abortSignal,
    )
  }

  function stopStreaming() {
    if (!controller || !$chatStreaming) return
    controller.abort()
    if (currentAssistantId) finishAssistant(currentAssistantId)
    chatStreaming.set(false)
    currentAssistantId = null
    controller = null
  }

  async function resetChat() {
    if (clearing) return
    const deck = get(currentDeck)
    if (!deck) return
    if ($chatStreaming) return
    try {
      clearing = true
      await api.resetChatHistory(deck.id)
      chatMessages.set([])
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
    {#if messages.length === 0}
      <div class="empty-state">
        <p>Ask the AI to build slides for you.</p>
      </div>
    {:else}
      {#each messages as msg (msg.id)}
        <ChatMessage message={msg} />
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
