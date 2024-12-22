import { parse, stringify } from 'mdxld'
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
  maxTokens?: number // Maximum tokens to generate (default: 100)
  instructions?: string // Instructions for content generation
}

export async function generateMDX(options: GenerateOptions) {
  const { type, filepath, content: inputContent, components = [], count = 1, topic, maxTokens = 100 } = options

  // Construct the system prompt
  const system = `You are an expert MDX content generator. Generate MDX content that follows ${type} schema.
${components.length > 0 ? `Use these components where appropriate: ${components.join(', ')}` : ''}
Important: Return ONLY the raw MDX content. Do not wrap it in code blocks or add any formatting.

The content MUST start with YAML frontmatter between --- markers, like this:
---
$type: https://schema.org/Article
title: Example Title
description: Brief description
---

The frontmatter MUST:
1. Start and end with --- on their own lines
2. Include either $type or @type field with the schema type
3. Include title and description fields
4. Use proper YAML indentation
5. Not use quotes around the schema type value

Keep content concise (around 100 tokens).`

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
      maxTokens: maxTokens || 100,
      temperature: 0.7,
    })

    // Create a buffer to accumulate the content
    let content = ''

    // Stream and accumulate content with timeout
    const streamTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Stream timeout')), 10000)
    )

    try {
      await Promise.race([
        (async () => {
          for await (const chunk of result.textStream) {
            content += chunk
          }
        })(),
        streamTimeout
      ])
    } catch (error) {
      if (error instanceof Error && error.message === 'Stream timeout') {
        console.warn('Stream timed out, using partial content')
      } else {
        throw error
      }
    }

    // Clean up any code block wrapping and extra whitespace
    content = content
      .replace(/^```mdx?\n/g, '') // Remove opening code block
      .replace(/\n```$/g, '') // Remove closing code block
      .replace(/^```\n/g, '') // Remove any other code blocks
      .replace(/\n```\n/g, '\n') // Remove inline code blocks
      .trim() // Remove extra whitespace

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
    } catch {
      // If parsing fails, try to fix common YAML issues
      const [frontmatter, ...rest] = content.split('---\n')
      const fixedFrontmatter = frontmatter
        .split('\n')
        .map((line) => {
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
      await mkdir(dirname(filepath), { recursive: true }).catch((error) => {
        console.error(`Error creating directory: ${error.message}`)
        throw error
      })

      // Write the complete content to file
      await writeFile(filepath, content, 'utf-8').catch((error) => {
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
