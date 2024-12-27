import { readFile, writeFile, exists } from './utils/fs.js'
import { join } from 'node:path'
import { ConfigurationError, GenerationError } from './utils/errors.js'
import { parse } from 'mdxld/ast'
import { createOpenAI } from '@ai-sdk/openai'
import { getConfig, validateConfig } from './config.js'
import type { ParseOptions, MDXLDData } from './types.js'

interface AIFunctionResult {
  content?: string
  [key: string]: unknown
}

interface AIFunctionData extends MDXLDData {
  model?: string
  system?: string
  output?: Record<string, unknown>
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
$type: AIFunction
$context: https://schema.org/
model: gpt-4o
system: 'You are an AI assistant helping with content generation'
metadata:
  keywords: []
  category: ai-function
  properties:
    version: '1.0.0'
    generator: 'mdxai'
output:
  placeholder: true
---

<!-- Add your custom content or instructions here -->
`

/**
 * Creates a proxy object that intercepts function calls and manages MDX files
 * in the ./ai directory. Each function call corresponds to an MDX file that
 * contains the configuration and instructions for the AI operation.
 */
export const ai = new Proxy({}, {
  get(_target: object, propKey: string | symbol): (args?: Record<string, unknown>) => Promise<AIFunctionResult> {
    return async function(args: Record<string, unknown> = {}): Promise<AIFunctionResult> {
      const fnName = String(propKey)
      
      if (!isNodeRuntime()) {
        throw new ConfigurationError('AI proxy is only supported in Node.js environment')
      }

      try {
        // Construct path to the MDX file in ./ai directory
        const aiDir = './ai'
        const filePath = join(aiDir, `${fnName}.mdx`)

        // Create the file with default frontmatter if it doesn't exist
        if (!(await exists(filePath))) {
          await writeFile(filePath, DEFAULT_FRONTMATTER)
        }

        // Read and parse the MDX file
        const content = await readFile(filePath)
        const parseOptions: ParseOptions = {
          ast: true,
          allowAtPrefix: true,
        }
        
        const ast = parse(content, parseOptions)
        if (!ast.data) {
          throw new GenerationError('Invalid MDX file: No frontmatter found')
        }

        const mdxData = ast.data as AIFunctionData
        
        // Get AI configuration
        const config = getConfig()
        validateConfig(config)

        // Create AI provider
        const provider = createOpenAI({
          apiKey: config.aiConfig.apiKey,
          baseURL: config.aiConfig.baseURL,
          compatibility: 'compatible',
        })

        // Get model from frontmatter or use default
        const selectedModel = mdxData.model?.startsWith('@cf/') 
          ? mdxData.model 
          : config.aiConfig.defaultModel || 'gpt-4o-mini'
        
        const languageModel = provider.languageModel(selectedModel)

        // Merge frontmatter with runtime args
        const mergedArgs = {
          ...mdxData,
          ...args,
        }

        try {
          // Generate content using the model
          const result = await languageModel.doGenerate({
            inputFormat: 'messages',
            mode: { type: 'regular' },
            prompt: [
              {
                role: 'system',
                content: mdxData.system || 'You are an AI assistant helping with content generation',
              },
              {
                role: 'user',
                content: [{ type: 'text', text: JSON.stringify(mergedArgs) }],
              },
            ],
            temperature: 0.7,
            maxTokens: 1000,
            responseFormat: { type: 'text' },
          })

          if (!result.text) {
            throw new GenerationError('Failed to generate content')
          }

          try {
            // Parse the result as JSON if it's valid JSON
            return JSON.parse(result.text) as AIFunctionResult
          } catch {
            // Return the raw text if it's not JSON
            return { content: result.text }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          throw new GenerationError(`Failed to generate content: ${message}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        throw new GenerationError(`Failed to process AI function ${fnName}: ${message}`)
      }
    }
  }
})
