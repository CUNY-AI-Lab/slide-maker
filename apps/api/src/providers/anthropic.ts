import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'

export type SplitSystemPrompt = { staticPrompt: string; dynamicContext: string }

const client = new Anthropic({ apiKey: env.anthropicApiKey })

export async function* streamAnthropic(
  system: string | SplitSystemPrompt,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: string = 'claude-sonnet-4-20250514',
): AsyncGenerator<string> {
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = typeof system === 'string'
    ? [{ type: 'text', text: system }]
    : [
        { type: 'text', text: system.staticPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: system.dynamicContext },
      ]

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemBlocks,
    messages,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
]

// Optionally expose Sonnet 4.6 via Anthropic SDK (admin-only in listing)
if (env.anthropicSonnet46Id) {
  ;(ANTHROPIC_MODELS as any).push({
    id: env.anthropicSonnet46Id,
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    adminOnly: true,
  })
}
