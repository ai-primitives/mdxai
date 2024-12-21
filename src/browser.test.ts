/// <reference lib="dom" />
import { describe, it, expect } from 'vitest'
import { generateMDX } from './browser'

describe('browser generateMDX', () => {
  it('should generate MDX content using Web Streams', async () => {
    const options = {
      type: 'https://schema.org/Article',
      content: '# Test Content\n\nThis is a test.',
      components: ['Alert', 'Button'],
    }

    const stream = await generateMDX(options)
    expect(stream).toBeInstanceOf(ReadableStream)

    // Read and concatenate stream chunks
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let totalLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalLength += value.length
    }

    // Properly concatenate Uint8Array chunks
    const concatenated = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      concatenated.set(chunk, offset)
      offset += chunk.length
    }

    const content = new TextDecoder().decode(concatenated)

    // Verify content structure
    expect(content).toContain('---')
    expect(content).toContain('$type: https://schema.org/Article')
    expect(content).toMatch(/import.*Alert.*from/)
    expect(content).toMatch(/import.*Button.*from/)
  })

  it('should handle topic-based content generation', async () => {
    const options = {
      type: 'https://schema.org/BlogPosting',
      count: 1,
      topic: 'TypeScript Development',
      components: ['CodeBlock'],
    }

    const stream = await generateMDX(options)
    expect(stream).toBeInstanceOf(ReadableStream)

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let totalLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalLength += value.length
    }

    // Properly concatenate Uint8Array chunks
    const concatenated = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      concatenated.set(chunk, offset)
      offset += chunk.length
    }

    const content = new TextDecoder().decode(concatenated)

    // Verify generated content
    expect(content).toContain('---')
    expect(content).toContain('$type: https://schema.org/BlogPosting')
    expect(content).toMatch(/import.*CodeBlock.*from/)
    expect(content).toContain('TypeScript')
  })

  it('should handle errors gracefully', async () => {
    const options = {
      type: 'https://schema.org/Article',
      // Missing required content
    }

    const stream = await generateMDX(options)
    const reader = stream.getReader()

    await expect(async () => {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }).rejects.toThrow('No content provided')
  })
})
