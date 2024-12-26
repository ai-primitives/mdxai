import { describe, it, expect, beforeEach } from 'vitest'
import { generateMDX, GenerateOptions } from '../index.js'

describe('generateMDX', () => {
  beforeEach(() => {
    // Set up environment variables for testing
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable must be set for tests')
    }
    process.env.AI_MODEL = 'gpt-4o-mini'
    process.env.AI_GATEWAY = process.env.AI_GATEWAY || 'https://api.test.com'
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
