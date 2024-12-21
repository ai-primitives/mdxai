import { AI } from 'ai-functions'
import { stringify } from 'mdxld'

interface WorkersEnv {
  AI: {
    run(model: string, options: { prompt: string }): Promise<{ text: string }>
  }
  AI_MODEL?: string
  AI_GATEWAY?: string
}

type AIProvider = {
  gpt: (strings: string[]) => Promise<string | null>
  list: (strings: string[]) => AsyncGenerator<string>
}

export interface GenerateOptions {
  type: string
  content?: string
  components?: string[]
  count?: number
  topic?: string
  env?: WorkersEnv
}

export async function generateMDX(options: GenerateOptions): Promise<ReadableStream<Uint8Array>> {
  const { type, content: inputContent, components = [], count, topic, env } = options

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let ai: AIProvider
        if (env?.AI && type.startsWith('@cf')) {
          const modelName = type.replace('@cf/', '')
          ai = {
            gpt: async (strings) => {
              const response = await env.AI.run(modelName, {
                prompt: strings.join('\n'),
              })
              return response.text || null
            },
            list: async function* (strings) {
              const response = await env.AI.run(modelName, {
                prompt: strings.join('\n'),
              })
              if (response.text) {
                yield response.text
              }
            },
          }
        } else if (env?.AI_GATEWAY || globalThis?.process?.env?.AI_GATEWAY) {
          const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
          const model = createOpenAICompatible({
            name: 'cloudflare',
            headers: {
              Authorization: `Bearer ${globalThis?.process?.env?.CF_WORKERS_AI_TOKEN}`,
            },
            baseURL: env?.AI_GATEWAY || globalThis?.process?.env?.AI_GATEWAY,
          })
          ai = {
            gpt: async (strings) => {
              const response = await model.chatModel(env?.AI_MODEL || globalThis?.process?.env?.AI_MODEL || 'gpt-3.5-turbo').doGenerate({
                inputFormat: 'messages',
                mode: {
                  type: 'regular',
                },
                prompt: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: strings.join('\n'),
                      },
                    ],
                  },
                ],
                temperature: 0.7,
                maxTokens: 2048,
              })
              return response.text || null
            },
            list: async function* (strings) {
              const response = await model.chatModel('gpt-3.5-turbo').doGenerate({
                inputFormat: 'messages',
                mode: {
                  type: 'regular',
                },
                prompt: [
                  {
                    role: 'system',
                    content: strings.join('\n'),
                  },
                ],
                temperature: 0.7,
                maxTokens: 2048,
              })

              if (response.text) {
                yield response.text
              }
            },
          }
        } else {
          const openai = AI({
            apiKey: globalThis?.process?.env?.OPENAI_API_KEY,
          })
          ai = {
            gpt: async (strings) => {
              const result = await openai.gpt(strings)
              return result || null
            },
            list: async function* (strings) {
              for await (const item of openai.list(strings)) {
                if (item) yield item
              }
            },
          }
        }

        if (count && topic) {
          const listItems = ai.list([
            `Generate ${count} titles for content about ${topic} following the schema:`,
            type,
            'Output only the titles, one per line.',
          ])

          for await (const title of listItems) {
            if (!title) continue
            const content = await ai.gpt([
              `Generate content for:`,
              title.trim(),
              `Following the schema:`,
              type,
              `Using components:`,
              components.join(', '),
              '',
              'Output MDX with frontmatter including $type and proper component imports.',
              'Ensure the content is well-structured and follows the schema type.',
            ])
            if (content) {
              const chunk = new TextEncoder().encode(content + '\n---\n')
              controller.enqueue(chunk)
            }
          }
        } else {
          const rawContent = inputContent
          if (!rawContent) throw new Error('No content provided')

          const processedContent = typeof rawContent === 'object' ? stringify(rawContent) : rawContent

          const generator = ai.list([
            'Given the content:',
            processedContent,
            'Generate MDX content following the schema:',
            type,
            'Using these components:',
            components.join(', '),
            '',
            'Output MDX with frontmatter and proper component imports.',
          ])

          for await (const chunk of generator) {
            if (chunk) {
              controller.enqueue(new TextEncoder().encode(chunk))
            }
          }
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return stream
}
