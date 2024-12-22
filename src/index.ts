import { parse, stringify, type MDXLD } from 'mdxld'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

const model = openai(process.env.OPENAI_MODEL || 'gpt-4o-mini')

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
  const system = `You are an expert MDX content generator. Generate MDX content that follows ${type} schema.
${components.length > 0 ? `Use these components where appropriate: ${components.join(', ')}` : ''}
Important: Return ONLY the raw MDX content. Do not wrap it in code blocks or add any formatting.
The frontmatter MUST include either a $type or @type field with the schema type (e.g. $type: https://schema.org/Article or @type: https://schema.org/Article).
Do not use quotes around the schema type value.
Format the frontmatter as valid YAML with proper indentation.`

  // Construct the user prompt
  const prompt = `Generate ${count > 1 ? `${count} different versions of` : ''} MDX content${
    topic ? ` about ${topic}` : ''
  }${inputContent ? ` based on this content:\n\n${inputContent}` : ''}.
Include appropriate frontmatter with schema.org metadata, including either $type or @type field without quotes.
Ensure the frontmatter is properly indented YAML.`

  try {
    // Use streamText to generate content
    const result = streamText({
      model,
      system,
      prompt,
      // maxTokens: 2000, // Adjust as needed
    })

    // Create a buffer to accumulate the content
    let content = ''

    // Stream and accumulate content
    for await (const chunk of result.textStream) {
      content += chunk
    }

    // Clean up any code block wrapping and extra whitespace
    content = content
      .replace(/^```mdx?\n/g, '')  // Remove opening code block
      .replace(/\n```$/g, '')      // Remove closing code block
      .replace(/^```\n/g, '')      // Remove any other code blocks
      .replace(/\n```\n/g, '\n')   // Remove inline code blocks
      .trim()                      // Remove extra whitespace

    try {
      // Parse the MDX content
      const parsed = parse(content)

      // Initialize data if not present
      if (!parsed.data) {
        parsed.data = {}
      }

      // Ensure the frontmatter has either $type or @type field
      if (!parsed.data['$type'] && !parsed.data['@type']) {
        parsed.data['$type'] = type
      }

      // Remove quotes from type values if present
      if (parsed.data['$type']) {
        parsed.data['$type'] = parsed.data['$type'].toString().replace(/^["']|["']$/g, '')
      }
      if (parsed.data['@type']) {
        parsed.data['@type'] = parsed.data['@type'].toString().replace(/^["']|["']$/g, '')
      }

      // Convert back to string
      content = stringify(parsed)
    } catch (parseError) {
      // If parsing fails, try to fix common YAML issues
      const [frontmatter, ...rest] = content.split('---\n')
      const fixedFrontmatter = frontmatter
        .split('\n')
        .map(line => {
          // Fix indentation and ensure proper YAML format
          if (line.trim().startsWith('$') || line.trim().startsWith('@')) {
            const [key, ...valueParts] = line.trim().split(':')
            const value = valueParts.join(':').trim()
            // Remove quotes from type values
            if (key === '$type' || key === '@type') {
              return `${key}: ${value.replace(/^["']|["']$/g, '')}`
            }
            return `${key}: "${value}"`
          }
          return line
        })
        .join('\n')

      content = `---\n${fixedFrontmatter}\n---\n${rest.join('---\n')}`
    }

    // If filepath is provided, ensure the directory exists and write to file
    if (filepath) {
      // Ensure the directory exists before attempting to write
      await mkdir(dirname(filepath), { recursive: true })
        .catch(error => {
          console.error(`Error creating directory: ${error.message}`)
          throw error
        })

      // Write the complete content to file
      await writeFile(filepath, content, 'utf-8')
        .catch(error => {
          console.error(`Error writing to file: ${error.message}`)
          throw error
        })
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
