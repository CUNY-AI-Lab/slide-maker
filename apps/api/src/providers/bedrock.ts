import { env } from '../env.js'
import OpenAI from 'openai'

/**
 * AWS Bedrock via the OpenAI-compatible Mantle API.
 * Uses BEDROCK_API_KEY as a bearer token against the regional Mantle endpoint.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html
 */

function getClient() {
  const region = env.awsRegion || 'us-gov-east-1'
  const apiKey = env.bedrockApiKey
  if (!apiKey) throw new Error('BEDROCK_API_KEY not set')

  return new OpenAI({
    apiKey,
    baseURL: `https://bedrock-mantle.${region}.api.aws/v1`,
  })
}

export async function* streamBedrock(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: string = 'anthropic.claude-3-5-haiku-20241022-v1:0',
): AsyncGenerator<string> {
  const client = getClient()

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content
    if (text) yield text
  }
}

export const BEDROCK_MODELS = [
  { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5 (AWS)', provider: 'bedrock' },
]

// Expose Sonnet 4.6 via Bedrock as admin-only.
;(BEDROCK_MODELS as any).push({
  id: env.bedrockSonnet46ModelId || 'anthropic.claude-sonnet-4-6',
  name: 'Claude Sonnet 4.6 (AWS)',
  provider: 'bedrock',
  adminOnly: true,
})
