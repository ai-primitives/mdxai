/// <reference lib="dom" />
import { vi, describe, it, expect } from 'vitest'
import { generateMDX } from './browser'
import { ReadableStream } from 'stream/web'
import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible'

// Mock AI provider
vi.mock('@ai-sdk/openai-compatible', async () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => ({
          data: {
            choices: [
              {
                delta: { content: 'Test content' },
                finish_reason: null,
              },
            ],
          },
        })),
      },
    },
  }

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
          const text = Array.isArray(prompt) ? prompt.map((m) => m.content[0].text).join('\n') : typeof prompt === 'string' ? prompt : prompt.content[0].text
          const lines = text.split('\n')
          const typeIndex = lines.findIndex(
            (line: string) =>
              line.includes('Following the schema:') || line.includes('following the schema:') || line.includes('Generate MDX content following the schema:'),
          )

          const componentsIndex = lines.findIndex((line: string) => line.includes('Using components:'))
          const components =
            componentsIndex >= 0 && lines[componentsIndex + 1] ? lines[componentsIndex + 1].split(',').map((c: string) => c.trim()) : ['Alert', 'Button']

          const type = typeIndex >= 0 && lines[typeIndex + 1] ? lines[typeIndex + 1].trim() : 'https://schema.org/Article'
          return {
            text: `---\n$type: ${type}\n---\n\n# Generated Content\n\nimport { ${components.join(', ')} } from "@/components"\n\nTest content`,
          }
        },
      ),
    doStream: vi.fn().mockImplementation(() => mockOpenAI.chat.completions.create()),
  }

  const embeddingModel = {
    specificationVersion: 'v1',
    provider: 'openai',
    modelId: 'text-embedding-ada-002',
    doEmbed: vi.fn(),
  }

  const mockProvider = {
    provider: 'openai',
    chatModel: vi.fn().mockReturnValue(modelImpl),
    languageModel: vi.fn().mockReturnValue(modelImpl),
    completionModel: vi.fn().mockReturnValue(modelImpl),
    textEmbeddingModel: vi.fn().mockReturnValue(embeddingModel),
  }

  return {
    createOpenAICompatible: vi.fn().mockReturnValue(() => ({
      AI: () => mockOpenAI,
      model: () => modelImpl,
      ...mockProvider,
    })),
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

    const reader = stream.getReader()
    const chunks: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value as unknown as string)
    }

    const content = chunks.join('')

    expect(content).toContain('---')
    expect(content).toContain('$type: https://schema.org/Article')
    expect(content).toMatch(/import.*Alert.*from/)
    expect(content).toMatch(/import.*Button.*from/)
  })

  it('should handle topic-based content generation', async () => {
    const stream = await generateMDX({
      type: 'https://schema.org/BlogPosting',
      topic: 'AI Development',
      count: 2,
      components: ['Alert', 'Button'],
    })

    expect(stream).toBeInstanceOf(ReadableStream)

    const reader = stream.getReader()
    const chunks: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value as unknown as string)
    }

    const content = chunks.join('')
    expect(content).toContain('$type: https://schema.org/BlogPosting')
    expect(content).toContain('import { Alert, Button } from "@/components"')
    expect(content).toContain('Test content')
  })

  it('should handle errors gracefully', async () => {
    const options = {
      type: 'https://schema.org/Article',
      // Missing required content
    }

    const errorModelImpl = {
      specificationVersion: 'v1',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn().mockRejectedValue(new Error('No content provided')),
      doStream: vi.fn().mockRejectedValue(new Error('No content provided')),
    }

    const errorProvider = {
      provider: 'openai',
      chatModel: vi.fn().mockReturnValue(errorModelImpl),
      languageModel: vi.fn().mockReturnValue(errorModelImpl),
      completionModel: vi.fn().mockReturnValue(errorModelImpl),
      textEmbeddingModel: vi.fn().mockReturnValue({
        specificationVersion: 'v1',
        provider: 'openai',
        modelId: 'text-embedding-ada-002',
        doEmbed: vi.fn(),
      }),
    }

    const errorProviderFn = Object.assign(vi.fn().mockReturnValue(errorModelImpl), errorProvider) as unknown as OpenAICompatibleProvider<string, string, string>

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
