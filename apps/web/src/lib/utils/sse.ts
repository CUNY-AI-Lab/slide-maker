import type { RenderDiagnostic } from '@slide-maker/shared'

export async function streamChat(
  message: string,
  deckId: string,
  activeSlideId: string | null,
  modelId: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  renderDiagnostics: RenderDiagnostic[],
  onText: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
  recentActions?: string[],
  lastAgentSlideId?: string | null,
): Promise<void> {
  const { API_URL } = await import('$lib/api')
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, deckId, activeSlideId, modelId, history, renderDiagnostics, recentActions, lastAgentSlideId }),
      signal,
    })
  } catch (e: any) {
    if (signal?.aborted) {
      onError('aborted')
      return
    }
    onError(e?.message || 'Chat request failed')
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    onError(body.error ?? 'Chat request failed')
    return
  }

  await consumeChatStream(response, onText, onDone, onError, signal)
}

/** Success requires the server's done event and a clean EOF. */
export async function consumeChatStream(
  response: Response,
  onText: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) { onError('Chat response was empty'); return }
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  let gotDone = false
  let failure: string | null = null
  function parse(frame: string) {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data) return
    const event: unknown = JSON.parse(data)
    if (!event || typeof event !== 'object' || !('type' in event)) throw new Error('Invalid chat response')
    if (event.type === 'error') {
      const message = 'message' in event && typeof event.message === 'string' ? event.message : 'Chat request failed'
      const requestId = 'requestId' in event && typeof event.requestId === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(event.requestId)
        ? event.requestId : null
      throw new Error(requestId ? `${message} Reference: ${requestId}` : message)
    }
    if (event.type === 'done') { gotDone = true; return }
    if (event.type !== 'text' || gotDone || !('content' in event) || typeof event.content !== 'string') throw new Error('Invalid chat response')
    onText(event.content)
  }
  try {
    while (true) {
      signal?.throwIfAborted()
      const chunk = await reader.read()
      signal?.throwIfAborted()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      buffer = buffer.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        parse(frame)
      }
      if (chunk.done) break
    }
    if (buffer.trim()) parse(buffer)
    if (!gotDone) throw new Error('Chat response ended before completion. Please try again.')
  } catch (error) {
    failure = signal?.aborted ? 'aborted' : error instanceof Error ? error.message : 'Chat response interrupted. Please try again.'
  } finally {
    signal?.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (failure !== null) onError(failure)
  else onDone()
}
