<script lang="ts">
  import { get } from 'svelte/store'
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
    chatStreaming.set(true)

    let fullText = ''

    await streamChat(
      text,
      deck.id,
      slideId,
      modelId,
      history,
      (chunk) => {
        fullText += chunk
        appendToAssistant(assistantId, chunk)
      },
      async () => {
        finishAssistant(assistantId)

        // Extract and apply mutations from the full response
        const mutations = extractMutations(fullText)
        for (const mutation of mutations) {
          try {
            await applyMutation(mutation)
          } catch (err) {
            console.error('Failed to apply mutation:', err, mutation)
          }
        }

        chatStreaming.set(false)
      },
      (error) => {
        appendToAssistant(assistantId, `\n\n[Error: ${error}]`)
        finishAssistant(assistantId)
        chatStreaming.set(false)
      },
    )
  }
</script>

<div class="chat-panel">
  <div class="chat-header">
    <span class="chat-title">AI Chat</span>
    <ModelSelector />
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

  .chat-title {
    padding: 8px 10px 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
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
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
</style>
