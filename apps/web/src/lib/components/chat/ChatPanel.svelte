<script lang="ts">
  import { get } from 'svelte/store'
  import { api } from '$lib/api'
  import ModelSelector from './ModelSelector.svelte'
  import ChatMessage from './ChatMessage.svelte'
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

  let messagesContainer: HTMLDivElement | undefined = $state()
  let messages = $state<ChatMsg[]>([])
  let clearing = $state(false)

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
    if (text.trim().startsWith('/search ')) {
      const query = text.trim().slice(8).trim()
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

    // Build history from current messages (exclude streaming)
    const history = get(chatMessages)
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))

    // Add user message
    addUserMessage(text)

    // Create streaming assistant message
    const assistantId = addAssistantMessage()
    appendToAssistant(assistantId, 'Thinking...')
    chatStreaming.set(true)

    let fullText = ''
    let firstChunk = true
    let appliedMutationCount = 0

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
      },
      (error) => {
        appendToAssistant(assistantId, `\n\n[Error: ${error}]`)
        finishAssistant(assistantId)
        chatStreaming.set(false)
      },
    )
  }

  async function resetChat() {
    if (clearing) return
    const deck = get(currentDeck)
    if (!deck) return
    const confirmMsg = 'Clear chat history for this deck? This action cannot be undone.'
    if (!window.confirm(confirmMsg)) return
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
    <span class="chat-title"><span class="brand-slide">Slide</span> <span class="brand-wiz">Wiz</span></span>
    <div class="chat-controls">
      <ModelSelector />
      <button class="reset-btn" title="Reset chat" onclick={resetChat} disabled={clearing} aria-label="Reset chat">
        {clearing ? '…' : 'Reset'}
      </button>
    </div>
  </div>

  <div class="messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-state">
        <p>Ask the AI to create slides, edit content, or change the theme.</p>
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
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .chat-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 8px;
  }

  .reset-btn {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .reset-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .chat-title {
    padding: 8px 10px 4px;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .brand-slide {
    color: #1a1a2e;
  }
  .brand-wiz {
    color: #5a8fd4;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
</style>
