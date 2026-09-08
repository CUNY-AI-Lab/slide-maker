import { describe, expect, it, vi } from 'vitest'
import { consumeChatStream } from '../apps/web/src/lib/utils/sse'
const text = 'data: {"type":"text","content":"partial"}\n\n'
const done = 'data: {"type":"done"}\n\n'
async function consume(response: Response, signal?: AbortSignal) {
  const onText = vi.fn(), onDone = vi.fn(), onError = vi.fn()
  await consumeChatStream(response, onText, onDone, onError, signal)
  return { onText, onDone, onError }
}
describe('browser chat completion', () => {
  it('completes exactly once only with explicit done and clean EOF', async () => {
    const result = await consume(new Response(text + done + done))
    expect(result.onText).toHaveBeenCalledWith('partial')
    expect(result.onDone).toHaveBeenCalledOnce()
    expect(result.onError).not.toHaveBeenCalled()
  })
  it('displays only validated support IDs', async () => {
    const id = 'aa5df029-30d5-4754-9f4f-902748280e38'
    const response = (requestId: string) => new Response(`data: ${JSON.stringify({ type: 'error', message: 'Request failed', requestId })}\n\n`)
    expect((await consume(response(id))).onError).toHaveBeenCalledWith(`Request failed Reference: ${id}`)
    expect((await consume(response('private@example.edu'))).onError).toHaveBeenCalledWith('Request failed')
  })
  it('reports incomplete EOF without success', async () => {
    const result = await consume(new Response(text))
    expect(result.onError).toHaveBeenCalledOnce()
    expect(result.onDone).not.toHaveBeenCalled()
  })
  it('does not finalize after a network interruption', async () => {
    let reads = 0
    const result = await consume(new Response(new ReadableStream({ pull(controller) {
      if (reads++ === 0) controller.enqueue(new TextEncoder().encode(text))
      else controller.error(new Error('connection interrupted'))
    } })))
    expect(result.onText).toHaveBeenCalledWith('partial')
    expect(result.onError).toHaveBeenCalledOnce()
    expect(result.onDone).not.toHaveBeenCalled()
  })
  it('reports trailing server error once instead of success', async () => {
    const result = await consume(new Response(text + done + 'data: {"type":"error","message":"Request timed out"}'))
    expect(result.onError).toHaveBeenCalledExactlyOnceWith('Request timed out')
    expect(result.onDone).not.toHaveBeenCalled()
  })
  it('rejects malformed events', async () => {
    const result = await consume(new Response(text + 'data: invalid\n\n' + done))
    expect(result.onError).toHaveBeenCalledOnce()
    expect(result.onDone).not.toHaveBeenCalled()
  })
  it('cancels a blocked reader and releases its lock on abort', async () => {
    const abort = new AbortController()
    const cancelled = vi.fn()
    const response = new Response(new ReadableStream({ cancel: cancelled }))
    const pending = consume(response, abort.signal)
    abort.abort()
    const result = await pending
    expect(result.onError).toHaveBeenCalledExactlyOnceWith('aborted')
    expect(result.onDone).not.toHaveBeenCalled()
    expect(cancelled).toHaveBeenCalledOnce()
    expect(response.body?.locked).toBe(false)
  })
})
