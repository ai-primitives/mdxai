import { Readable } from 'node:stream'
import { AI } from 'ai-functions'
import { parse, stringify } from 'mdxld'

export interface GenerateOptions {
  type: string
  filepath?: string
  content?: string
  components?: string[]
  count?: number
  topic?: string
}

export async function generateMDX(options: GenerateOptions): Promise<Readable> {
  const { type, filepath, content: inputContent, components = [], count, topic } = options

  const stream = new Readable({
    read() {},
  })

  try {
    const ai = AI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    if (count && topic) {
      // Recursive generation
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

      const content = typeof rawContent === 'object' ? stringify(rawContent) : rawContent

      const generator = ai.list([
        'Given the content:',
        content,
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
