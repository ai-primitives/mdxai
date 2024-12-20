import { Readable } from 'node:stream'
import { AI } from 'ai-functions'
import { parse, stringify } from 'mdxld'

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
  filepath?: string
  content?: string
  components?: string[]
  count?: number
  topic?: string
  env?: WorkersEnv
}

export async function generateMDX(options: GenerateOptions): Promise<Readable> {
  const { type, filepath, content: inputContent, components = [], count, topic, env } = options

  const stream = new Readable({
    read() {},
  })

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
    } else if (env?.AI_GATEWAY || process.env.AI_GATEWAY) {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
      const model = createOpenAICompatible({
        name: 'cloudflare',
        headers: {
          Authorization: `Bearer ${process.env.CF_WORKERS_AI_TOKEN}`,
        },
        baseURL: env?.AI_GATEWAY || process.env.AI_GATEWAY,
      })
      ai = {
        gpt: async (strings) => {
          const response = await model.chatModel(env?.AI_MODEL || process.env.AI_MODEL || 'gpt-3.5-turbo').doGenerate({
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
          const response = await model.chatModel(env?.AI_MODEL || process.env.AI_MODEL || 'gpt-3.5-turbo').doGenerate({
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
          if (response.text) {
            yield response.text
          }
        },
      }
    } else {
      const openai = AI({
        apiKey: process.env.OPENAI_API_KEY,
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
      const listItems = ai.list([`Generate ${count} titles for content about ${topic} following the schema:`, type, 'Output only the titles, one per line.'])

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
        if (content) stream.push(content + '\n---\n')
      }
    } else {
      const rawContent = filepath ? await parse(filepath) : inputContent
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
        if (chunk) stream.push(chunk)
      }
    }

    stream.push(null)
  } catch (error) {
    stream.emit('error', error)
  }

  return stream
}
