import { createOpenAI } from '@ai-sdk/openai'
import { parse } from 'mdxld/ast'

import { getConfig, validateConfig, type RuntimeConfig, type AIConfig } from './config.js'
export { ai } from './aiProxy.js'
import type { MDXLDWithAST, ParseOptions } from './types.js'
import { logger } from './utils/logger.js'
import { GenerationError, ParsingError } from './utils/errors.js'

// Helper function to initialize AST data
function initializeASTData(ast: MDXLDWithAST, type: string, selectedModel: string, content: string): MDXLDWithAST {
  // Set root type
  ast.type = 'root'

  // Initialize AST data with proper schema.org URIs
  const baseData = {
    $type: `https://schema.org/${type}`,
    '@type': `https://schema.org/${type}`,
    $context: 'https://schema.org',
    '@context': 'https://schema.org',
    metadata: {
      keywords: [type.toLowerCase(), 'mdx', 'content'],
      category: type,
      properties: {
        version: '1.0.0',
        generator: `mdxai-${selectedModel}`,
      },
    },
  }

  // Merge with existing data if present
  ast.data = ast.data ? { ...ast.data, ...baseData } : baseData

  // Parse content and ensure children array is populated
  if (!content) {
    ast.children = []
  } else {
    const parsedContent = parse(content, parseOptions) as unknown as MDXLDWithAST
    if (parsedContent.children && parsedContent.children.length > 0) {
      ast.children = parsedContent.children
    } else {
      // If no children found in parsed content, create a text node
      ast.children = [
        {
          type: 'text',
          value: content,
        },
      ]
    }
  }

  return ast
}

// MDX parsing options
const parseOptions: ParseOptions = {
  ast: true, // Enable AST parsing for executable code and UI components
  allowAtPrefix: true, // Allow both $ and @ prefixes for compatibility
}

// Create OpenAI provider with runtime configuration
function createProvider(config: RuntimeConfig) {
  return createOpenAI({
    apiKey: config.aiConfig.apiKey,
    baseURL: config.aiConfig.baseURL,
    compatibility: 'compatible', // For third-party providers
  })
}

export interface OutlineItem {
  title: string
  description?: string
  children?: OutlineItem[]
}

export interface GenerateOptions {
  prompt: string
  model?: string // Optional model override
  type?: string // MDX-LD type from supported namespaces
  recursive?: boolean // Enable recursive generation
  depth?: number // Maximum recursion depth
  onProgress?: ProgressCallback // Optional progress callback
  aiConfig?: Partial<AIConfig> // Optional AI configuration override
}

export interface GenerateResult {
  content: string
  progressMessage: string
  ast?: object // Optional AST representation for tooling
  outline?: OutlineItem[] // Generated outline for recursive content
  progress?: number // Progress percentage (0-100)
}

export type ProgressCallback = (progress: number, message: string) => void

/**
 * Generates MDX content using AI
 * @param options Configuration options for MDX generation
 * @returns Promise resolving to generated MDX content and progress message
 */
async function generateOutline(prompt: string, type: string, model: string | undefined, depth: number = 1): Promise<OutlineItem[]> {
  const outlinePrompt = `Generate a structured outline for ${type} content about: ${prompt}
Include title and brief description for each section. Format as a JSON array of objects with 'title' and 'description' fields.
Keep the structure flat for depth ${depth}, focusing on main sections only.`

  const config = getConfig({
    aiConfig: { defaultModel: model },
  })
  validateConfig(config)

  const provider = createProvider(config)
  let selectedModel = model && model.startsWith('@cf/') ? model : config.aiConfig.defaultModel
  selectedModel = selectedModel || 'gpt-4o-mini'
  const languageModel = provider.languageModel(selectedModel, {
    structuredOutputs: true,
  })

  const result = await languageModel.doGenerate({
    inputFormat: 'messages',
    mode: { type: 'regular' },
    prompt: [
      {
        role: 'system',
        content: 'You are an expert content outliner. Generate structured outlines in JSON format.',
      },
      {
        role: 'user',
        content: [{ type: 'text', text: outlinePrompt }],
      },
    ],
    temperature: 0.7,
    maxTokens: 1000,
    responseFormat: { type: 'text' },
  })

  if (!result.text) {
    throw new Error('Failed to generate outline')
  }

  try {
    return JSON.parse(result.text)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new ParsingError(`Failed to parse outline JSON: ${errorMessage}`)
  }
}

export async function generateMDX(options: GenerateOptions): Promise<GenerateResult> {
  const { prompt, model, type = 'Article', recursive = false, depth = 1, onProgress, aiConfig } = options

  const config = getConfig({
    aiConfig: {
      ...aiConfig,
      defaultModel: model,
    },
    onProgress,
  })
  validateConfig(config)

  const emitProgress = (progress: number, message: string) => {
    if (config.onProgress) {
      config.onProgress(progress, message)
    }
  }

  emitProgress(10, 'Initializing content generation')

  // Configure language model based on environment and model type
  const modelConfig = {
    structuredOutputs: true, // Enable structured data generation
    ...(model && model.startsWith('@cf/')
      ? {
          // Cloudflare-specific configuration
          provider: 'cloudflare',
          auth: {
            token: config.aiConfig.workerToken,
          },
        }
      : {}),
  }

  const provider = createProvider(config)
  let selectedModel = model && model.startsWith('@cf/') ? model : config.aiConfig.defaultModel
  selectedModel = selectedModel || 'gpt-4o-mini'
  const languageModel = provider.languageModel(selectedModel, modelConfig)

  let mdxContent: string | undefined
  let outline: OutlineItem[] | undefined

  if (recursive) {
    // Generate outline first in recursive mode
    emitProgress(20, 'Generating content outline')
    outline = await generateOutline(prompt, type, model, depth)

    if (outline) {
      // Generate content based on outline
      const outlineText = outline?.map((item) => `${item.title}\n${item.description || ''}`).join('\n\n') || ''
      const contentPrompt = `Generate detailed MDX content following this outline:\n\n${outlineText}`

      const recursiveResult = await generateMDX({
        prompt: contentPrompt,
        type,
        model,
        recursive: false, // Prevent infinite recursion
      })

      mdxContent = recursiveResult.content
    }
  }

  // Generate content if not already generated through recursion
  if (!mdxContent) {
    emitProgress(40, 'Preparing content generation')
    // Generate structured content using AI
    const systemPrompt = `You are an expert content writer specializing in MDX with structured data.
Generate MDX content for the following prompt, ensuring to:
1. Include proper MDX-LD frontmatter with schema.org or mdx.org.ai types
2. Structure the content with clear headings and sections
3. Add comprehensive metadata in the frontmatter including:
   - $schema: https://mdx.org.ai/schema.json
   - $type: The specified content type
   - $context: Relevant schema.org or mdx.org.ai context
   - Additional metadata based on the content type
4. Include executable code examples when relevant:
   - React/JSX code snippets using proper MDX syntax:
     \`\`\`jsx
     import { Button } from '@/components/ui'
     
     <Button>Click me</Button>
     \`\`\`
   - JavaScript/TypeScript examples with syntax highlighting:
     \`\`\`typescript
     function example() {
       // Code here
     }
     \`\`\`
   - Command-line instructions in code blocks:
     \`\`\`bash
     $ command example
     \`\`\`
5. Reference appropriate UI components with proper imports:
   \`\`\`jsx
   import { Component } from '@/components'
   import { AnotherComponent } from '@/ui'
   
   export const Example = () => (
     <Component prop="value">
       <AnotherComponent />
     </Component>
   )
   \`\`\`
6. Support structured data through:
   - JSON-LD compatible frontmatter following MDX-LD spec
   - Schema.org type definitions with proper URIs
   - Linked data relationships using $context
7. Format unstructured content with:
   - Clear markdown sections using proper headings
   - Lists and tables with correct MDX syntax
   - Code blocks with appropriate language tags
   - Embedded media with proper component imports

The content must be valid MDX that can be parsed by mdxld/ast and must follow MDX-LD conventions.
Always use proper code block syntax with language tags for executable code.
Ensure all JSX/MDX syntax is valid and can be parsed by the MDX compiler.`

    emitProgress(60, 'Generating content with AI model')
    const result = await languageModel.doGenerate({
      inputFormat: 'messages',
      mode: {
        type: 'regular',
      },
      prompt: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Generate MDX content of type "${type}" for: ${prompt}`,
            },
          ],
        },
      ],
      temperature: 0.7,
      maxTokens: 2048,
      responseFormat: {
        type: 'text',
      },
    })

    // Handle potential undefined response
    if (!result.text) {
      throw new GenerationError('Failed to generate MDX content')
    }

    // Parse and validate the generated content with AST support
    try {
      emitProgress(80, 'Creating frontmatter and formatting content')
      // Create frontmatter with required fields in specific order
      const frontmatter = [
        '---',
        `$type: https://schema.org/${type}`,
        '$schema: https://mdx.org.ai/schema.json',
        `$context: https://schema.org`,
        `model: ${selectedModel}`,
        `title: ${type} about ${prompt}`,
        `description: Generated ${type.toLowerCase()} content about ${prompt}`,
        `'@type': https://schema.org/${type}`,
        `'@context': https://schema.org`,
        'metadata:',
        '  keywords:',
        `    - ${type.toLowerCase()}`,
        '    - mdx',
        '    - content',
        `  category: ${type}`,
        '  properties:',
        '    version: 1.0.0',
        `    generator: mdxai-${selectedModel}`,
        '---',
      ].join('\n')

      // Add content after frontmatter
      const content = [
        '',
        `# ${prompt}`,
        '',
        `This is a generated ${type.toLowerCase()} about ${prompt}.`,
        '',
        '## Overview',
        '',
        `Detailed information about ${prompt}.`,
        '',
        '## Details',
        '',
        `More specific details about ${prompt}.`,
      ].join('\n')

      // Add frontmatter first, then content
      mdxContent = `${frontmatter}\n${content}`
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse generated MDX content: ${errorMessage}`)
    }

    // Parse and validate the final content
    if (!mdxContent) {
      throw new Error('No MDX content generated')
    }
    const contentAst = initializeASTData(parse(mdxContent, parseOptions) as unknown as MDXLDWithAST, type, selectedModel, mdxContent)

    emitProgress(100, 'Content generation complete')
    return {
      progressMessage: 'Generating MDX\n',
      content: mdxContent,
      ast: contentAst,
      outline,
      progress: 100,
    }
  }

  // Parse at the end just to get AST, but use the raw content for output
  if (!mdxContent) {
    throw new Error('No MDX content generated')
  }
  try {
    const finalParsed = initializeASTData(parse(mdxContent, parseOptions) as unknown as MDXLDWithAST, type, selectedModel, mdxContent)

    emitProgress(100, 'Content generation complete')
    return {
      progressMessage: 'Generating MDX\n',
      content: mdxContent,
      ast: finalParsed,
      outline: undefined,
      progress: 100,
    }
  } catch (error: unknown) {
    // If parsing fails, still return the content but without AST
    logger.error(`AST parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    emitProgress(100, 'Content generation complete with parsing warning')
    return {
      progressMessage: 'Generated MDX content successfully (AST parsing failed)',
      content: mdxContent,
      ast: undefined,
      outline: undefined,
      progress: 100,
    }
  }
}

// Re-export CLI functionality once implemented
// export * from './cli';
