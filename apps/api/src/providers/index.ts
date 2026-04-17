import { streamAnthropic, ANTHROPIC_MODELS, type SplitSystemPrompt } from './anthropic.js'
import { streamOpenRouter, OPENROUTER_MODELS } from './openrouter.js'
import { streamBedrock, BEDROCK_MODELS } from './bedrock.js'
import { env } from '../env.js'

export type { SplitSystemPrompt }

export const ALL_MODELS = [...ANTHROPIC_MODELS, ...OPENROUTER_MODELS, ...BEDROCK_MODELS]

function flattenSystem(system: string | SplitSystemPrompt): string {
  return typeof system === 'string' ? system : `${system.staticPrompt}\n\n${system.dynamicContext}`
}

export function getModelStream(
  modelId: string,
  system: string | SplitSystemPrompt,
  messages: { role: 'user' | 'assistant'; content: string }[],
): AsyncGenerator<string> {
  const model = ALL_MODELS.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (env.aiProvider && model.provider !== env.aiProvider) {
    throw new Error(`Model provider '${model.provider}' not allowed by AI_PROVIDER=${env.aiProvider}`)
  }
  if (model.provider === 'anthropic') return streamAnthropic(system, messages, modelId)
  if (model.provider === 'bedrock') return streamBedrock(flattenSystem(system), messages, modelId)
  return streamOpenRouter(flattenSystem(system), messages, modelId)
}
