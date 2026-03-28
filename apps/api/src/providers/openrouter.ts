import OpenAI from 'openai'
import { env } from '../env.js'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.openrouterApiKey,
})

export async function* streamOpenRouter(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: string = 'google/gemini-3.1-flash-lite-preview',
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
  }
}

export const OPENROUTER_MODELS = [
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', provider: 'openrouter' },
  { id: 'z-ai/glm-5', name: 'GLM 5', provider: 'openrouter' },
  { id: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash', provider: 'openrouter' },
  { id: 'qwen/qwen3.5-flash-02-23', name: 'Qwen 3.5 Flash', provider: 'openrouter' },
]
