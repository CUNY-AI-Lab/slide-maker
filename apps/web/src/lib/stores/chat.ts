import { writable } from 'svelte/store'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export const chatMessages = writable<ChatMsg[]>([])
export const chatStreaming = writable(false)
export const selectedModelId = writable('google/gemini-3.1-flash-lite-preview')

/** Set from any component to inject text into the chat input without sending. */
export const chatDraft = writable<string>('')

let msgCounter = 0

export function addUserMessage(content: string): string {
  const id = `msg-${++msgCounter}`
  chatMessages.update((msgs) => [...msgs, { id, role: 'user', content }])
  return id
}

export function addAssistantMessage(): string {
  const id = `msg-${++msgCounter}`
  chatMessages.update((msgs) => [...msgs, { id, role: 'assistant', content: '', streaming: true }])
  return id
}

export function appendToAssistant(id: string, text: string) {
  chatMessages.update((msgs) =>
    msgs.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
  )
}

export function finishAssistant(id: string) {
  chatMessages.update((msgs) =>
    msgs.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
  )
}
