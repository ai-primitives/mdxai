/// <reference lib="dom" />
import { describe, it, expect, vi } from 'vitest'
import { generateMDX } from './browser'
import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible'

// Mock AI provider
vi.mock('@ai-sdk/openai-compatible', async () => {
  const modelImpl = {
    specificationVersion: 'v1',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    defaultObjectGenerationMode: 'json',
    doGenerate: vi
      .fn()
      .mockImplementation(
        async ({
          prompt,
        }: {
          prompt: Array<{ role: string; content: Array<{ type: string; text: string }> }> | string | { content: Array<{ type: string; text: string }> }
        }) => {
          // Extract type from prompt messages
          const text = Array.isArray(prompt) ? prompt.map((m) => m.content[0].text).join('\n') : typeof prompt === 'string' ? prompt : prompt.content[0].text
          const lines = text.split('\n')
          const typeIndex = lines.findIndex(
            (line: string) =>
              line.includes('Following the schema:') || line.includes('following the schema:') || line.includes('Generate MDX content following the schema:'),
          )

          // Extract components from prompt
          const componentsIndex = lines.findIndex((line: string) => line.includes('Using components:'))
          const components =
            componentsIndex >= 0 && lines[componentsIndex + 1] ? lines[componentsIndex + 1].split(',').map((c: string) => c.trim()) : ['Alert', 'Button']

          const type = typeIndex >= 0 && lines[typeIndex + 1] ? lines[typeIndex + 1].trim() : 'https://schema.org/Article'
          return {
            text: `---\n$type: ${type}\n---\n\n# Generated Content\n\nimport { ${components.join(', ')} } from "@/components"\n\nTest content`,
          }
        },
      ),
    doStream: vi.fn(),
  }

  const embeddingModel = {
    specificationVersion: 'v1',
    provider: 'openai',
    modelId: 'text-embedding-ada-002',
    doEmbed: vi.fn(),
  }

  const mockProvider = {
    provider: 'openai',
    chatModel: vi.fn().mockImplementation(() => modelImpl),
    languageModel: vi.fn().mockImplementation(() => modelImpl),
    completionModel: vi.fn().mockImplementation(() => modelImpl),
    textEmbeddingModel: vi.fn().mockImplementation(() => embeddingModel),
  }

  // Create provider function with correct type
  const providerFn = Object.assign(
    vi.fn().mockImplementation(() => modelImpl),
    mockProvider,
  ) as unknown as OpenAICompatibleProvider<string, string, string>

  return {
    createOpenAICompatible: vi.fn().mockReturnValue(providerFn),
  }
})

describe('browser generateMDX', () => {
  it('should generate MDX content using Web Streams', async () => {
    const options = {
      type: 'https://schema.org/Article',
      content: 'Test content',
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
      count: 5,
      contentType: 'blog posts',
      topic: 'AI development',
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
    expect(content).toContain('Generated Content')
  })

  it('should handle errors gracefully', async () => {
    const options = {
      type: 'https://schema.org/Article',
      // Missing required content
    }

    // Mock error case
    const errorModelImpl = {
      specificationVersion: 'v1',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn().mockImplementation(async () => {
        throw new Error('No content provided')
      }),
      doStream: vi.fn(),
    }

    const errorEmbeddingModel = {
      specificationVersion: 'v1',
      provider: 'openai',
      modelId: 'text-embedding-ada-002',
      doEmbed: vi.fn(),
    }

    const errorMockProvider = {
      provider: 'openai',
      chatModel: vi.fn().mockImplementation(() => errorModelImpl),
      languageModel: vi.fn().mockImplementation(() => errorModelImpl),
      completionModel: vi.fn().mockImplementation(() => errorModelImpl),
      textEmbeddingModel: vi.fn().mockImplementation(() => errorEmbeddingModel),
    }

    // Create error provider function with correct type
    const errorProviderFn = Object.assign(
      vi.fn().mockImplementation(() => errorModelImpl),
      errorMockProvider,
    ) as unknown as OpenAICompatibleProvider<string, string, string>

    vi.mocked(await import('@ai-sdk/openai-compatible')).createOpenAICompatible.mockReturnValueOnce(errorProviderFn)

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
