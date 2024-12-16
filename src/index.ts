import { Readable } from 'node:stream'
import { AI } from 'ai-functions'
import { parse, stringify } from 'mdxld'

export interface GenerateOptions {
  type: string
  filepath?: string
  content?: string
  components?: string[]
}

export async function generateMDX(options: GenerateOptions): Promise<Readable> {
  const { type, filepath, content: inputContent, components = [] } = options

  const stream = new Readable({
    read() {}
  })

  try {
    const rawContent = filepath ? await parse(filepath) : inputContent
    if (!rawContent) throw new Error('No content provided')

    const content = typeof rawContent === 'object' ? stringify(rawContent) : rawContent

    const ai = AI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const generator = ai.list([
      'Given the content:',
      content,
      'Generate MDX content following the schema:',
      type,
      'Using these components:',
      components.join(', '),
      '',
      'Output MDX with frontmatter and proper component imports.'
    ])

    for await (const chunk of generator) {
      if (chunk) stream.push(chunk)
    }

    stream.push(null)
  } catch (error) {
    stream.emit('error', error)
  }

  return stream
}
