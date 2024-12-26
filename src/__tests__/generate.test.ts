import { describe, it, expect } from 'vitest'
import { generateMDX, GenerateOptions } from '../index.js'

describe('generateMDX', () => {
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
