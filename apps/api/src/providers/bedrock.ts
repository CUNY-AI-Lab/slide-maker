import { env } from '../env.js'

/**
 * AWS Bedrock via native SDK with IAM credentials.
 * Supports both IAM auth (AWS_ACCESS_KEY_ID/SECRET) and ABSK bearer token (Mantle API).
 * Set AWS_REGION and provide credentials via env vars or AWS credential chain.
 */

// Lazy import to avoid requiring the package unless used
async function loadBedrock() {
  const mod = await import('@aws-sdk/client-bedrock-runtime')
  return {
    BedrockRuntimeClient: mod.BedrockRuntimeClient,
    ConverseStreamCommand: mod.ConverseStreamCommand,
  }
}

export async function* streamBedrock(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: string = 'anthropic.claude-3-5-haiku-20241022-v1:0',
): AsyncGenerator<string> {
  const { BedrockRuntimeClient, ConverseStreamCommand } = await loadBedrock()

  const region = env.awsRegion || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'

  const clientConfig: Record<string, unknown> = { region }

  // Explicit IAM credentials from env (takes precedence over credential chain)
  const accessKey = process.env.AWS_ACCESS_KEY_ID
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY
  if (accessKey && secretKey) {
    clientConfig.credentials = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
    }
  }

  const client = new BedrockRuntimeClient(clientConfig)

  const command = new ConverseStreamCommand({
    modelId: model,
    system: [{ text: systemPrompt }],
    messages: messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens: 4096,
    },
  })

  const res = await client.send(command)

  if (res.stream) {
    for await (const event of res.stream) {
      if (event.contentBlockDelta?.delta?.text) {
        yield event.contentBlockDelta.delta.text
      }
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
