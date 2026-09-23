import { describe, expect, it, vi } from 'vitest'
vi.mock('../apps/api/src/fleet/log.js', () => ({ logGatewayOutcome: vi.fn() }))
import { getModelStream, readGatewayStream, safeGatewayError } from '../apps/api/src/providers/index.js'
import { createRequire } from 'node:module'
const { createCailClient, CailError } = createRequire(new URL('../apps/api/package.json', import.meta.url))('@cuny-ai-lab/cail-client')

const text = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
async function collect(response: Response, signal = new AbortController().signal) {
  let result = ''
  for await (const chunk of readGatewayStream(response, signal)) result += chunk
  return result
}
describe('Gateway streaming contract', () => {
  it('accepts DONE with a trailing usage chunk before DONE and unknown usage', async () => {
    await expect(collect(new Response(text + 'data: {"choices":[],"usage":null}\n\ndata: [DONE]\n\n'))).resolves.toBe('Hello')
  })
  it('accepts usage after DONE while continuing to EOF', async () => {
    await expect(collect(new Response(text + 'data: [DONE]\n\ndata: {"choices":[],"usage":null}\n\n'))).resolves.toBe('Hello')
  })
  it('rejects EOF without DONE', async () => {
    await expect(collect(new Response(text))).rejects.toThrow('before completion')
  })
  it('rejects trailing error even without final frame separator', async () => {
    await expect(collect(new Response(text + 'data: [DONE]\n\ndata: {"error":{"message":"sensitive","code":"upstream_failure","type":"server_error"}}'))).rejects.toThrow()
  })
  it('cancels a blocked upstream reader on abort', async () => {
    const controller = new AbortController()
    const cancel = vi.fn()
    const response = new Response(new ReadableStream({ cancel }))
    const result = collect(response, controller.signal)
    controller.abort()
    await expect(result).rejects.toThrow()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('handles byte splits in CRLF framing', async () => {
    const bytes = new TextEncoder().encode((text + 'data: [DONE]\n\n').replaceAll('\n', '\r\n'))
    const response = new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    } }))
    await expect(collect(response)).resolves.toBe('Hello')
  })
  it('uses the actual client JWT and conversation protocol without local keys', async () => {
    const requests: Request[] = []
    const client = createCailClient({ app: 'slide-maker', fetchImpl: async (input, init) => {
      requests.push(new Request(input, init))
      return new Response(text + 'data: [DONE]\n\n')
    } })
    let output = ''
    for await (const chunk of getModelStream('gateway-model', 'system', [{ role: 'user', content: 'input' }], { token: 'jwt-token', sessionId: 'deck-123', signal: new AbortController().signal, correlation: { request_id: 'aa5df029-30d5-4754-9f4f-902748280e38', trace_id: '1'.repeat(32), span_id: '2'.repeat(16), trace_flags: 0 } }, client)) output += chunk
    expect(output).toBe('Hello')
    expect(requests).toHaveLength(1)
    expect(requests[0].headers.get('x-cail-identity-jwt')).toBe('jwt-token')
    expect(requests[0].headers.get('x-cail-session-id')).toBe('deck-123')
    expect(requests[0].headers.get('x-cail-request-id')).toBe('aa5df029-30d5-4754-9f4f-902748280e38')
    expect(requests[0].headers.get('traceparent')).toBe(`00-${'1'.repeat(32)}-${'2'.repeat(16)}-00`)
    expect(requests[0].url).toBe('https://tools.ailab.gc.cuny.edu/v1/chat/completions')
  })
  it('exposes only validated support IDs, never provider messages', () => {
    const id = 'aa5df029-30d5-4754-9f4f-902748280e38'
    expect(safeGatewayError(new CailError('x', 'private', 500, { request_id: id }))).toEqual({ message: expect.any(String), requestId: id })
    expect(JSON.stringify(safeGatewayError(new Error('private')))).not.toContain('private')
    expect(safeGatewayError(new CailError('x', 'private', 500, { request_id: 'email@example.org' }))).not.toHaveProperty('requestId')
  })
})
