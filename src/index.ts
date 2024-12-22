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

  try {
    // Use streamText to generate content
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 2000, // Adjust as needed
    })

    // Create a buffer to accumulate the content
    let content = ''

    // Stream and accumulate content
    for await (const chunk of result.textStream) {
      content += chunk
    }

    // If filepath is provided, ensure the directory exists and write to file
    if (filepath) {
      try {
        // Ensure the directory exists
        await mkdir(dirname(filepath), { recursive: true })
        // Write the complete content to file
        await writeFile(filepath, content, 'utf-8')
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error writing to file: ${error.message}`)
        }
        throw error
      }
    }

    // Get the final results
    const finishReason = await result.finishReason
    const usage = await result.usage

    return {
      stream: result.textStream,
      text: content,
      finishReason,
      usage,
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error generating MDX: ${error.message}`)
    }
    throw error
  }
}
