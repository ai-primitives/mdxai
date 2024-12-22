import { parse, stringify } from 'mdxld'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

const model = openai('gpt-4o')

export interface GenerateOptions {
  type: string
  filepath?: string
  content?: string
  components?: string[]
  count?: number
  topic?: string
}

export async function generateMDX(options: GenerateOptions) {
  const { type, filepath, content: inputContent, components = [], count = 1, topic } = options

  // Construct the system prompt
  const systemPrompt = `You are an expert MDX content generator. Generate MDX content that follows ${type} schema.
${components.length > 0 ? `Use these components where appropriate: ${components.join(', ')}` : ''}`

  // Construct the user prompt
  const userPrompt = `Generate ${count > 1 ? `${count} different versions of` : ''} MDX content${
    topic ? ` about ${topic}` : ''
  }${inputContent ? ` based on this content:\n\n${inputContent}` : ''}.
Include appropriate frontmatter with schema.org metadata.`

  // Use streamText to generate content
  const { textStream, text, finishReason, usage } = await streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 2000, // Adjust as needed
  })

  // If filepath is provided, ensure the directory exists and stream to file
  if (filepath) {
    try {
      // Ensure the directory exists
      await mkdir(dirname(filepath), { recursive: true })

      // Create a buffer to accumulate the content
      let content = ''

      // Stream to both stdout and accumulate for file
      for await (const chunk of textStream) {
        process.stdout.write(chunk) // Write to stdout
        content += chunk // Accumulate for file
      }

      // Write the complete content to file
      await writeFile(filepath, content, 'utf-8')
    } catch (error) {
      console.error(`Error writing to file: ${error.message}`)
      throw error
    }
  } else {
    // If no filepath, just stream to stdout
    for await (const chunk of textStream) {
      process.stdout.write(chunk)
    }
  }

  return {
    stream: textStream,
    text,
    finishReason,
    usage,
  }
}
