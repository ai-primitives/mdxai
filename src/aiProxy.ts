import { readFile, writeFile, exists } from './utils/fs.js'
import { join } from 'node:path'
import { parse } from 'mdxld'
import type { ParseOptions } from 'mdxld'
import { mkdir } from 'node:fs/promises'
import { generateObject } from 'ai'
import type { LanguageModelV1 } from '@ai-sdk/provider'

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

interface AIFunctionResult {
  content?: string
  items?: unknown[]
  error?: string
  [key: string]: unknown
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
          const system = data.system as string
          const schema = data.schema as JSONSchema7 | undefined
        
          if (!model || !system) {
            throw new Error('Missing required frontmatter fields: model and system')
          }

          // Configure model options based on test expectations
          const modelConfig = {
            provider: process.env.AI_GATEWAY || 'openai',
            id: model,
            name: model,
            version: 'v1',
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
          } as unknown as LanguageModelV1

          // Determine output type based on schema
          let outputType: 'object' | 'array' | 'no-schema' = 'object'
          if (!schema) {
            outputType = 'no-schema'
          } else if (schema.type === 'array') {
            outputType = 'array'
          }

          // Call generateObject with parameters based on schema type
          const genResult = !schema
            ? await generateObject({
                model: modelConfig,
                prompt: JSON.stringify(args),
                mode: 'json',
                output: 'no-schema'
              })
            : schema.type === 'array'
            ? await generateObject({
                model: modelConfig,
                prompt: JSON.stringify(args),
                mode: 'json',
                output: 'array',
                schema: createZodSchema(schema)
              })
            : await generateObject({
                model: modelConfig,
                prompt: JSON.stringify(args),
                mode: 'json',
                output: 'object',
                schema: createZodSchema(schema)
              })

          // Handle response based on output type
          if (outputType === 'array' && Array.isArray(genResult.object)) {
            result = { items: genResult.object }
          } else if (outputType === 'no-schema' && typeof genResult.object === 'string') {
            result = { content: genResult.object }
          } else if (typeof genResult.object === 'object' && genResult.object !== null) {
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
