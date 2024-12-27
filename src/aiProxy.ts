import { readFile, writeFile, exists } from './utils/fs.js'
import { join } from 'node:path'
import { parse } from 'mdxld/ast'
import { getConfig, validateConfig } from './config.js'
import type { ParseOptions, MDXLDData } from './types.js'
import { generateObject } from 'ai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  LanguageModelV1Message,
  LanguageModelV1ObjectGenerationMode,
  LanguageModelV1ProviderMetadata,
  LanguageModelV1CallWarning,
  LanguageModelV1FunctionToolCall,
  LanguageModelV1LogProbs
} from '@ai-sdk/provider'
import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema'
import { z } from 'zod'

// Create Zod schema conversion function
const createZodSchema = (schema: JSONSchema7): z.ZodType => {
  if (schema.type === 'array' && schema.items) {
    const itemSchema = schema.items as JSONSchema7
    return z.array(createZodSchema(itemSchema))
  }
  if (schema.type === 'object' && schema.properties) {
    const shape: { [key: string]: z.ZodType } = {}
    for (const [key, prop] of Object.entries(schema.properties)) {
      shape[key] = createZodSchema(prop as JSONSchema7)
    }
    return z.object(shape)
  }
  if (schema.type === 'string') return z.string()
  if (schema.type === 'number') return z.number()
  if (schema.type === 'boolean') return z.boolean()
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
  model: LanguageModelV1
  prompt: string
  temperature?: number
  maxTokens?: number
  mode: LanguageModelV1ObjectGenerationMode
  system?: string
  name?: string
  description?: string
  output?: 'object' | 'array' | 'no-schema'
  schema?: JSONSchema7
}


interface AIFunctionResult {
  content?: string
  items?: unknown[]
  error?: string
  [key: string]: unknown
}

interface AIFunctionData extends MDXLDData {
  model?: string
  system?: string
  output?: Record<string, unknown>
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
schema:
  type: object
  properties:
    content:
      type: string
      description: 'The generated content'
  required: ['content']
output:
  content: 'Generated content will appear here'
---

<!-- Add your custom content or instructions here -->
`

/**
 * Creates a proxy object that intercepts function calls and manages MDX files
 * in the ./ai directory. Each function call corresponds to an MDX file that
 * contains the configuration and instructions for the AI operation.
 */
export const ai: Record<string, (args?: Record<string, unknown>) => Promise<AIFunctionResult>> = new Proxy({}, {
  get(_target: object, propKey: string | symbol): (args?: Record<string, unknown>) => Promise<AIFunctionResult> {
    return async function(args: Record<string, unknown> = {}): Promise<AIFunctionResult> {
      const fnName = String(propKey)
      const result: AIFunctionResult = { content: '' }
      
      try {
        if (!isNodeRuntime()) {
          result.error = 'AI proxy is only supported in Node.js environment'
          return result
        }
        // Construct path to the MDX file in ./ai directory
        const aiDir = join(process.cwd(), 'ai')
        const filePath = join(aiDir, `${fnName}.mdx`)

        // Create the file with default frontmatter if it doesn't exist
        if (!(await exists(filePath))) {
          await writeFile(filePath, DEFAULT_FRONTMATTER)
        }

        // Read and parse the MDX file
        const content = await readFile(filePath)
        let mdxData: AIFunctionData
        const parseOptions: ParseOptions = {
          ast: true,
          allowAtPrefix: true
        }
        
        try {
          const ast = parse(content, parseOptions)
          if (!ast.data) {
            result.error = 'Invalid MDX file: No frontmatter found'
            return result
          }
          mdxData = ast.data as AIFunctionData
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          result.error = `Failed to process AI function: ${errorMessage}`
          return result
        }
        
        // Get AI configuration
        const config = getConfig()
        validateConfig(config)

        // Get model from frontmatter or use default
        const selectedModel = mdxData.model?.startsWith('@cf/') 
          ? mdxData.model 
          : config.aiConfig.defaultModel || 'gpt-4o-mini'

        // Configure OpenAI model adapter
        const baseURL = config.aiConfig.baseURL || 'https://api.openai.com'
        const apiKey = config.aiConfig.apiKey

        // Initialize the model adapter with proper types
        const modelAdapter: LanguageModelV1 = {
          specificationVersion: 'v1' as const,
          provider: 'openai' as const,
          modelId: selectedModel,
          defaultObjectGenerationMode: 'json' as const,
          supportsStructuredOutputs: true,
          supportsImageUrls: false,
          doGenerate: (options: LanguageModelV1CallOptions): PromiseLike<{
            text?: string;
            toolCalls?: Array<LanguageModelV1FunctionToolCall>;
            finishReason: LanguageModelV1FinishReason;
            usage: {
              promptTokens: number;
              completionTokens: number;
            };
            rawCall: {
              rawPrompt: unknown;
              rawSettings: Record<string, unknown>;
            };
            rawResponse?: {
              headers?: Record<string, string>;
            };
            request?: {
              body?: string;
            };
            response?: {
              id?: string;
              timestamp?: Date;
              modelId?: string;
            };
            warnings?: LanguageModelV1CallWarning[];
            providerMetadata?: LanguageModelV1ProviderMetadata;
            logprobs?: LanguageModelV1LogProbs;
          }> => (async () => {
            try {
              const response = await fetch(`${baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                  ...(options.headers || {})
                },
                body: JSON.stringify({
                  model: selectedModel,
                  messages: options.prompt.map((msg) => ({
                    role: msg.role,
                    content: msg.role === 'system'
                      ? msg.content
                      : Array.isArray(msg.content)
                        ? msg.content.map((part) => {
                            if ('type' in part && part.type === 'text') return part.text
                            return ''
                          }).join('')
                        : ''
                  })),
                  temperature: options.temperature ?? 0.7,
                  max_tokens: options.maxTokens ?? 2048,
                  top_p: options.topP,
                  frequency_penalty: options.frequencyPenalty,
                  presence_penalty: options.presencePenalty,
                  stop: options.stopSequences,
                  stream: false,
                  response_format: { type: 'json_object' }
                })
              })

              if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
              }

              const requestBody = {
                model: selectedModel,
                messages: options.prompt.map((msg) => ({
                  role: msg.role,
                  content: msg.role === 'system'
                    ? msg.content
                    : Array.isArray(msg.content)
                      ? msg.content.map((part) => {
                          if ('type' in part && part.type === 'text') return part.text
                          return ''
                        }).join('')
                      : ''
                })),
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 2048,
                response_format: { type: 'json_object' }
              }

              const result = await response.json() as ModelResponse
              const text = result.choices?.[0]?.message?.content
              const responseHeaders = Object.fromEntries(response.headers.entries())

              return {
                text: text ?? undefined,
                toolCalls: undefined,
                finishReason: (result.choices?.[0]?.finish_reason ?? 'stop') as LanguageModelV1FinishReason,
                usage: {
                  promptTokens: result.usage?.prompt_tokens ?? 0,
                  completionTokens: result.usage?.completion_tokens ?? 0
                },
                rawCall: {
                  rawPrompt: options.prompt,
                  rawSettings: requestBody
                },
                rawResponse: {
                  headers: responseHeaders
                },
                request: {
                  body: JSON.stringify(requestBody)
                },
                response: {
                  id: result.id,
                  timestamp: result.created ? new Date(result.created * 1000) : undefined,
                  modelId: selectedModel
                },
                logprobs: undefined,
                warnings: undefined
              }
            } catch (err) {
              throw new Error(`Generate error: ${(err as Error).message}`)
            }
          })(),
          doStream: async (options: LanguageModelV1CallOptions) => {
            try {
              const response = await fetch(`${baseURL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                  ...(options.headers || {})
                },
                body: JSON.stringify({
                  model: selectedModel,
                  messages: options.prompt.map((msg) => ({
                    role: msg.role,
                    content: msg.role === 'system'
                      ? msg.content
                      : Array.isArray(msg.content)
                        ? msg.content.map((part) => {
                            if ('type' in part && part.type === 'text') return part.text
                            return ''
                          }).join('')
                        : ''
                  })),
                  temperature: options.temperature ?? 0.7,
                  max_tokens: options.maxTokens ?? 2048,
                  top_p: options.topP,
                  frequency_penalty: options.frequencyPenalty,
                  presence_penalty: options.presencePenalty,
                  stop: options.stopSequences,
                  stream: true,
                  response_format: { type: 'json_object' }
                })
              })

              if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
              }

              return {
                stream: response.body as ReadableStream<LanguageModelV1StreamPart>,
                rawCall: {
                  rawPrompt: options.prompt,
                  rawSettings: {
                    temperature: options.temperature,
                    maxTokens: options.maxTokens,
                    mode: options.mode
                  }
                }
              }
            } catch (err) {
              throw new Error(`Stream error: ${(err as Error).message}`);
            }
          }
      };

      try {
        // Initialize variables for generation
        let zodSchema: z.ZodType | undefined
        let genOutput: 'object' | 'array' | 'no-schema' = 'no-schema'

          // Handle schema if present in frontmatter
          if (mdxData.schema?.type) {
            const schemaType = mdxData.schema.type as JSONSchema7TypeName;
            
            // Validate schema type
            if (!['object', 'array'].includes(schemaType)) {
              result.error = `Invalid schema type: ${schemaType}. Must be 'object' or 'array'`;
              return result;
            }

            // Convert schema and set output mode
            zodSchema = createZodSchema(mdxData.schema as JSONSchema7);
            genOutput = schemaType as 'object' | 'array';
          }

          // Merge frontmatter with runtime args
          const mergedArgs = {
            ...mdxData,
            ...args,
          };

          // Always use json mode and handle schema appropriately
          // Prepare messages for generation
          const messages: LanguageModelV1Message[] = [
            {
              role: 'system',
              content: mdxData.system || `Generate ${fnName} based on the provided arguments`,
            },
            {
              role: 'user',
              content: [{
                type: 'text',
                text: JSON.stringify(mergedArgs),
              }],
            },
          ];

          // Type definition for generate options
          type GenerateObjectOptions = {
            model: LanguageModelV1;
            messages: LanguageModelV1Message[];
            mode: 'json';
            output: 'object' | 'array' | 'no-schema';
            schema?: z.ZodType;
            temperature?: number;
            maxTokens?: number;
          };
          
          const jsonSchema = zodSchema ? zodToJsonSchema(zodSchema) as JSONSchema7 : undefined;
          const output: 'object' | 'array' | 'no-schema' = 
            jsonSchema && 'type' in jsonSchema && jsonSchema.type === 'array' ? 'array' :
            jsonSchema ? 'object' : 'no-schema';
          let genResult;
          const baseOptions = {
            model: modelAdapter,
            messages,
            mode: 'json' as const,
            temperature: 0.7,
            maxTokens: 2048
          };

          if (!zodSchema || output === 'no-schema') {
            genResult = await generateObject({
              ...baseOptions,
              output: 'no-schema' as const
            });
          } else if (output === 'array') {
            genResult = await generateObject({
              ...baseOptions,
              output: 'array' as const,
              schema: zodSchema as z.ZodType<unknown[]>
            });
          } else {
            genResult = await generateObject({
              ...baseOptions,
              schema: zodSchema as z.ZodType<Record<string, unknown>>
            });
          }
          const response = genResult.object;

          // Format result based on output type
          if (mdxData.schema?.type === 'array' && Array.isArray(response)) {
            result.items = response;
          } else if (typeof response === 'object' && response !== null) {
            Object.assign(result, response);
          } else if (response !== undefined) {
            result.content = String(response);
          } else {
            result.error = 'Invalid response format received';
          }
        } catch (err) {
          result.error = `Failed to generate content: ${(err as Error).message}`
        }
      } catch (err) {
        result.error = `Failed to process AI function: ${(err as Error).message}`
      }
      
      // Always return the result object
      return result;
    }
  }
}) as Record<string, (args?: Record<string, unknown>) => Promise<AIFunctionResult>>
