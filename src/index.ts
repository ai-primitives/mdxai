import { parse, stringify } from 'mdxld'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const openaiClient = openai('gpt-4o')

export interface GenerateOptions {
  type: string
  filepath?: string
  content?: string
  components?: string[]
  count?: number
  topic?: string
}

export async function generateMDX(options: GenerateOptions) {
  const { type, filepath, content: inputContent, components = [], count, topic } = options
}
