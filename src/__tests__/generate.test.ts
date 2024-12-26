import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { generateMDX, GenerateOptions } from '../index.js'

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
          `$type: ${type}`,
          '$schema: https://mdx.org.ai/schema.json',
          `model: ${model}`,
          `title: ${type} about ${userPrompt}`,
          `description: Generated ${type.toLowerCase()} content about ${userPrompt}`,
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

        const mdxContent = frontmatter + content

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

  it('should support custom MDX-LD types', async () => {
    const options: GenerateOptions = {
      prompt: 'Write a product description',
      type: 'Product',
      model: 'gpt-4o-mini',
    }
    const result = await generateMDX(options)

    // Verify type in frontmatter
    expect(result.content).toMatch(/\$type: Product/)
    expect(result.content).toContain('product description')
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
