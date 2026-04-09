import { env } from '../env.js'

// Lazy import to avoid requiring the package unless used
async function loadBedrock() {
  try {
    const mod = await import('@aws-sdk/client-bedrock-runtime')
    return {
      BedrockRuntimeClient: (mod as any).BedrockRuntimeClient,
      InvokeModelWithResponseStreamCommand: (mod as any).InvokeModelWithResponseStreamCommand,
    }
  } catch {
    return { BedrockRuntimeClient: null, InvokeModelWithResponseStreamCommand: null }
  }
}

function toAnthropicMessages(
  messages: { role: 'user' | 'assistant'; content: string }[],
) {
  return messages.map((m) => ({
    role: m.role,
    content: [{ type: 'text', text: m.content }],
  }))
}

export async function* streamBedrock(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: string = 'anthropic.claude-3-5-haiku-20241022-v1:0',
): AsyncGenerator<string> {
  const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = await loadBedrock()
  if (!BedrockRuntimeClient || !InvokeModelWithResponseStreamCommand) {
    throw new Error('AWS Bedrock SDK not installed. Run pnpm add -w @aws-sdk/client-bedrock-runtime')
  }
  const region = env.awsRegion || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
  if (!region) throw new Error('AWS region not configured. Set AWS_REGION in .env')

  const clientConfig: Record<string, any> = { region }
  if (env.bedrockApiKey) {
    clientConfig.token = { token: env.bedrockApiKey }
  }
  const client = new BedrockRuntimeClient(clientConfig)

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    system: systemPrompt,
    messages: toAnthropicMessages(messages),
  }

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: model,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const res = await client.send(command)
  // res.body is an async iterable of events
  for await (const evt of res.body) {
    if (!evt?.chunk?.bytes) continue
    try {
      const j = JSON.parse(Buffer.from(evt.chunk.bytes).toString('utf8'))
      if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') {
        const text = j.delta.text as string
        if (text) yield text
      }
    } catch {
      // ignore malformed chunks
    }
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
