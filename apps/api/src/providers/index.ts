import { correlationFromHeaders, type CailCorrelation } from '@cuny-ai-lab/cail-log'
import { CailError, createCailClient, extractCailError, type CailClient } from '@cuny-ai-lab/cail-client'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { logGatewayOutcome } from '../fleet/log.js'

export const gateway = createCailClient({ app: 'slide-maker', allowInsecureLoopback: process.env.NODE_ENV === 'test', ...(process.env.CAIL_GATEWAY_URL ? { baseUrl: process.env.CAIL_GATEWAY_URL } : {}) })
export type SplitSystemPrompt = { staticPrompt: string; dynamicContext: string }

export function gatewayErrorStatus(error: unknown): ContentfulStatusCode {
  if (error instanceof CailError && [400, 401, 403, 404, 409, 429, 503].includes(error.status)) return error.status as ContentfulStatusCode
  return 502
}

export function safeGatewayError(error: unknown) {
  const requestId = error instanceof CailError ? error.extras.request_id : undefined
  return {
    message: 'The model request could not be completed. Please try again.',
    ...(typeof requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)
      ? { requestId } : {}),
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read to EOF even after DONE: a trailing Gateway error invalidates the turn. */
export async function* readGatewayStream(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.ok || !response.body) throw new Error('Gateway response unavailable')
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  function parse(frame: string): string[] {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data) return []
    if (data === '[DONE]') { done = true; return [] }
    const value: unknown = JSON.parse(data)
    const gatewayError = extractCailError(value)
    if (gatewayError) throw gatewayError
    if (!record(value) || value.error || frame.split('\n').some(line => /^event:\s*error\s*$/.test(line))) throw new Error('Gateway stream error')
    if (done && (!Array.isArray(value.choices) || value.choices.length !== 0 || !('usage' in value))) throw new Error('Unexpected data after completion')
    if (!Array.isArray(value.choices)) throw new Error('Invalid Gateway chunk')
    const text: string[] = []
    for (const choice of value.choices) {
      if (!record(choice)) throw new Error('Invalid Gateway choice')
      if (record(choice.delta) && typeof choice.delta.content === 'string') text.push(choice.delta.content)
    }
    return text
  }
  try {
    while (true) {
      signal.throwIfAborted()
      const chunk = await reader.read()
      signal.throwIfAborted()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      // Normalize only complete CRLF sequences, preserving a CR split across reads.
      buffer = buffer.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        yield* parse(frame)
      }
      if (chunk.done) break
    }
    if (buffer.trim()) yield* parse(buffer)
    if (!done) throw new Error('Gateway stream ended before completion')
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function* getModelStream(
  modelId: string,
  system: string | SplitSystemPrompt,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: { token: string; sessionId: string; signal: AbortSignal; correlation?: CailCorrelation },
  client: CailClient = gateway,
): AsyncGenerator<string> {
  const correlation = options.correlation ?? correlationFromHeaders(new Headers())
  const requestId = correlation.request_id
  try {
    const response = await client.chatCompletions({
      model: modelId,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: typeof system === 'string' ? system : `${system.staticPrompt}\n\n${system.dynamicContext}` },
        ...messages,
      ],
    }, { kind: 'jwt', token: options.token }, {
      sessionId: options.sessionId,
      signal: options.signal,
      correlation,
    })
    yield* readGatewayStream(response, options.signal)
    logGatewayOutcome(requestId, 'ok')
  } catch (error) {
    logGatewayOutcome(requestId, options.signal.aborted ? 'cancelled' : 'error')
    if (options.signal.aborted) throw error
    if (error instanceof CailError) {
      throw new CailError(error.code, 'Gateway request failed', error.status, { request_id: error.extras.request_id ?? requestId }, error.type)
    }
    throw new CailError('upstream_failure', 'Gateway request failed', 502, { request_id: requestId })
  }
}
