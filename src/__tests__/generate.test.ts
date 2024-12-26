import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { generateMDX, GenerateOptions } from '../index.js'
import type { MDXLDAST } from '../types.js'

// Mock the AI SDK at module level
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockImplementation(() => ({
    languageModel: vi.fn().mockImplementation((model) => ({
      doGenerate: vi.fn().mockImplementation((options) => {
        // Get the actual prompt text and type from the options
        const promptText = options.prompt[0]?.text || ''
        const type = options.type || 'Article'
        const userPrompt = promptText

        // Create frontmatter with required fields in specific order
        const frontmatter = [
          '---',
          `$type: https://schema.org/${type}`,
          '$schema: https://mdx.org.ai/schema.json',
          `$context: https://schema.org`,
          `model: ${model}`,
          `title: ${type} about ${userPrompt}`,
          `description: Generated ${type.toLowerCase()} content about ${userPrompt}`,
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
          `    generator: mdxai-${model}`,
          '---',
        ].join('\n')

        const content = [
          '',
          `# ${userPrompt}`,
          '',
          `This is a generated ${type.toLowerCase()} about ${userPrompt}.`,
          '',
          '## Overview',
          '',
          `Detailed information about ${userPrompt}.`,
          '',
          '## Details',
          '',
          `More specific details about ${userPrompt}.`,
        ].join('\n')

        const mdxContent = `${frontmatter}${content}`

        return Promise.resolve({
          text: mdxContent,
          progressMessage: 'Generating MDX\n',
          content: mdxContent,
        })
      }),
    })),
  })),
}))

describe('generateMDX', () => {
  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'gpt-4o-mini'
    process.env.AI_GATEWAY = 'https://api.test.com'

    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })
  it('should generate MDX content with proper frontmatter', async () => {
    const options: GenerateOptions = {
      prompt: 'Write about the history of AI',
      model: 'gpt-4o-mini',
    }
    const result = await generateMDX(options)

    // Validate content structure rather than exact matches
    expect(result.content).toBeDefined()
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(50)
    expect(result.progressMessage).toBe('Generating MDX\n')

    // Verify frontmatter structure
    expect(result.content).toMatch(/^---\n/)
    expect(result.content).toMatch(/\$schema: https:\/\/mdx\.org\.ai\/schema\.json/)
    expect(result.content).toMatch(/\$type:/)
    expect(result.content).toMatch(/model: gpt-4o-mini/)
    expect(result.content).toMatch(/---\n/)

    // Verify content includes prompt context
    expect(result.content).toContain('history of AI')
  })

  it('should support custom MDX-LD types with proper schema.org URIs', async () => {
    const options: GenerateOptions = {
      prompt: 'Write a product description',
      type: 'Product',
      model: 'gpt-4o-mini',
    }
    const result = await generateMDX(options)

    // Verify schema.org URIs and both prefix styles
    expect(result.content).toMatch(/\$type: https:\/\/schema\.org\/Product/)
    expect(result.content).toMatch(/'@type': https:\/\/schema\.org\/Product/)
    expect(result.content).toMatch(/\$context: https:\/\/schema\.org/)
    expect(result.content).toMatch(/'@context': https:\/\/schema\.org/)

    // Verify nested metadata structure
    expect(result.content).toMatch(/metadata:/)
    expect(result.content).toMatch(/keywords:/)
    expect(result.content).toMatch(/- product/)
    expect(result.content).toMatch(/properties:/)
    expect(result.content).toMatch(/version: 1\.0\.0/)

    // Verify content length and structure
    expect(result.content.length).toBeGreaterThan(500)
    expect(result.content).toContain('product description')
  })

  it('should handle complex nested frontmatter properties', async () => {
    const options: GenerateOptions = {
      prompt: 'Write about AI technology',
      type: 'TechArticle',
      model: 'gpt-4o-mini',
    }
    const result = await generateMDX(options)

    // Verify frontmatter structure
    expect(result.content).toMatch(/metadata:/)
    expect(result.content).toMatch(/category: TechArticle/)
    expect(result.content).toMatch(/properties:/)
    expect(result.content).toMatch(/generator: mdxai-gpt-4o-mini/)

    // Verify content meets minimum length
    expect(result.content.length).toBeGreaterThan(500)

    // Verify AST parsing and root object properties
    expect(result.ast).toBeDefined()
    const ast = result.ast as MDXLDAST
    expect(ast.data).toBeDefined()
    expect(ast.data.$type).toBe('https://schema.org/TechArticle')
    expect(ast.data['@type']).toBe('https://schema.org/TechArticle')
    expect(ast.data.$context).toBe('https://schema.org')
    expect(ast.data['@context']).toBe('https://schema.org')
  })

  it('should validate structural properties and value types', async () => {
    const options: GenerateOptions = {
      prompt: 'Test different value types',
      type: 'Dataset',
      model: 'gpt-4o-mini',
    }
    const result = await generateMDX(options)

    // Verify content structure
    expect(result.content).toMatch(/^---\n/) // Starts with frontmatter
    expect(result.content).toMatch(/---\n/) // Ends frontmatter correctly
    expect(result.content).toMatch(/\n# /) // Has main heading after frontmatter
    expect(result.content).toMatch(/## /) // Has subheadings

    // Verify metadata value types
    expect(result.content).toMatch(/version: 1\.0\.0/) // Number
    expect(result.content).toMatch(/keywords:\n\s+- /) // Array
    expect(result.content).toMatch(/properties:\n\s+/) // Object

    // Verify AST parsing
    expect(result.ast).toBeDefined()
    const ast = result.ast as MDXLDAST
    expect(ast.children).toBeInstanceOf(Array)
    expect(ast.children.length).toBeGreaterThan(0)
    expect(ast.data.metadata).toBeDefined()
    expect(Array.isArray(ast.data.metadata.keywords)).toBe(true)
    expect(typeof ast.data.metadata.properties).toBe('object')
  })

  it('should use gpt-4o-mini as default model', async () => {
    const options: GenerateOptions = {
      prompt: 'Write a short note',
    }
    const result = await generateMDX(options)

    // Verify default model in frontmatter
    expect(result.content).toMatch(/model: gpt-4o-mini/)
  })
})
