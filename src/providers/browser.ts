/// <reference lib="dom" />
import { AI } from 'ai-functions'

interface AIProviderOptions {
  apiKey?: string
  gateway?: string
  model?: string
}

interface AIResponse {
  text: string | null
}

export function createAIProvider(options: AIProviderOptions) {
  const { apiKey, gateway, model = 'gpt-3.5-turbo' } = options

  if (gateway) {
    return {
      gpt: async (strings: string[]): Promise<string | null> => {
        const response = await fetch(gateway, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${globalThis?.process?.env?.CF_WORKERS_AI_TOKEN || ''}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: strings.join('\n'),
              },
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        })

        if (!response.ok) {
          throw new Error(`AI gateway error: ${response.statusText}`)
        }

        const data = (await response.json()) as AIResponse
        return data.text
      },
      list: async function* (strings: string[]): AsyncGenerator<string> {
        const response = await fetch(gateway, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${globalThis?.process?.env?.CF_WORKERS_AI_TOKEN || ''}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: strings.join('\n'),
              },
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        })

        if (!response.ok) {
          throw new Error(`AI gateway error: ${response.statusText}`)
        }

        const data = (await response.json()) as AIResponse
        if (data.text) {
          yield data.text
        }
      },
    }
  }

  // Default to OpenAI provider
  const ai = AI({ apiKey })
  return {
    gpt: async (strings: string[]): Promise<string | null> => {
      return ai.gpt(strings)
    },
    list: async function* (strings: string[]): AsyncGenerator<string> {
      for await (const item of ai.list(strings)) {
        if (item) yield item
      }
    },
  }
}
