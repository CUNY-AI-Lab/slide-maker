export async function streamChat(
  message: string,
  deckId: string,
  activeSlideId: string | null,
  modelId: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  onText: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const { API_URL } = await import('$lib/api')
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, deckId, activeSlideId, modelId, history }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    onError(body.error ?? 'Chat request failed')
    return
  }

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data) continue
      try {
        const event = JSON.parse(data)
        if (event.type === 'text') onText(event.content)
        else if (event.type === 'done') onDone()
        else if (event.type === 'error') onError(event.message)
      } catch {
        /* ignore malformed SSE data */
      }
    }
  }
}
