import { createOpenAI } from '@ai-sdk/openai'
import { parse, stringify } from 'mdxld/ast'

// Default model can be overridden by AI_MODEL env var
const DEFAULT_MODEL = 'gpt-4o-mini'

// MDX parsing options
const parseOptions = {
  ast: true, // Enable AST parsing for executable code and UI components
  allowAtPrefix: true, // Allow both $ and @ prefixes for compatibility
}

// Create OpenAI provider with environment-based configuration
const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_GATEWAY,
  compatibility: 'compatible', // For third-party providers
})

export interface OutlineItem {
  title: string
  description?: string
  children?: OutlineItem[]
}

export interface GenerateOptions {
  prompt: string
  model?: string // default to gpt-4o-mini
  type?: string // MDX-LD type from supported namespaces
  recursive?: boolean // Enable recursive generation
  depth?: number // Maximum recursion depth
}

export interface GenerateResult {
  content: string
  progressMessage: string
  ast?: object // Optional AST representation for tooling
  outline?: OutlineItem[] // Generated outline for recursive content
}

/**
 * Generates MDX content using AI
 * @param options Configuration options for MDX generation
 * @returns Promise resolving to generated MDX content and progress message
 */
async function generateOutline(prompt: string, type: string, model: string, depth: number = 1): Promise<OutlineItem[]> {
  const outlinePrompt = `Generate a structured outline for ${type} content about: ${prompt}
Include title and brief description for each section. Format as a JSON array of objects with 'title' and 'description' fields.
Keep the structure flat for depth ${depth}, focusing on main sections only.`

  const languageModel = provider.languageModel(model.startsWith('@cf/') ? model : DEFAULT_MODEL, {
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
    throw new Error(`Failed to parse outline JSON: ${errorMessage}`)
  }
}

export async function generateMDX(options: GenerateOptions): Promise<GenerateResult> {
  const { prompt, model = process.env.AI_MODEL || DEFAULT_MODEL, type = 'Article', recursive = false, depth = 1 } = options

  // Configure language model based on environment and model type
  const modelConfig = {
    structuredOutputs: true, // Enable structured data generation
    ...(model.startsWith('@cf/')
      ? {
          // Cloudflare-specific configuration
          provider: 'cloudflare',
          auth: {
            token: process.env.CF_WORKERS_AI_TOKEN,
          },
        }
      : {}),
  }

  const languageModel = provider.languageModel(model.startsWith('@cf/') ? model : DEFAULT_MODEL, modelConfig)

  let mdxContent: string | undefined
  let outline: OutlineItem[] | undefined

  if (recursive) {
    // Generate outline first in recursive mode
    outline = await generateOutline(prompt, type, model, depth)

    if (outline) {
      // Generate content based on outline
      const outlineText = outline.map((item) => `${item.title}\n${item.description || ''}`).join('\n\n')
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
      throw new Error('Failed to generate MDX content')
    }

    const generatedText = result.text || ''

    // Parse and validate the generated content with AST support
    try {
      // First ensure proper frontmatter structure
      const rawContent = generatedText.trim().startsWith('---')
        ? generatedText
        : `---
$schema: https://mdx.org.ai/schema.json
$type: ${type}
model: ${model}
---

${generatedText}`

      // Parse with AST support to validate MDX structure
      const parsed = parse(rawContent, parseOptions)

      // Stringify back to MDX, preserving AST structure
      mdxContent = stringify(parsed, { useAtPrefix: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse generated MDX content: ${errorMessage}`)
    }

    // Parse one final time to get AST for tooling
    if (!mdxContent) {
      throw new Error('Failed to generate MDX content')
    }

    const finalParsed = parse(mdxContent, parseOptions)

    const generatedResult: GenerateResult = {
      progressMessage: recursive ? 'Generated outline and MDX content\n' : 'Generated MDX content\n',
      content: mdxContent,
      ast: finalParsed.ast,
      outline,
    }
    return generatedResult
  }

  // Parse content for non-recursive path
  const nonRecursiveParsed = parse(mdxContent, parseOptions)
  const nonRecursiveResult: GenerateResult = {
    progressMessage: 'Generated MDX content\n',
    content: mdxContent,
    ast: nonRecursiveParsed.ast,
    outline: undefined,
  }
  return nonRecursiveResult
}

// Re-export CLI functionality once implemented
// export * from './cli';
