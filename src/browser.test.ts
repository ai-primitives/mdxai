/// <reference lib="dom" />
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { generateMDX } from './browser'

// PLACEHOLDER: rest of the test file implementation

// Mock AI provider
vi.mock('ai-functions', () => ({
  AI: vi.fn().mockReturnValue({
    gpt: vi.fn().mockImplementation(async () => null),
    list: vi.fn().mockImplementation(async function* () {
      // Empty generator
    }),
  }),
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn().mockReturnValue(() => ({
    provider: 'openai',
    AI: () => ({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('No content provided')),
        },
      },
    }),
    apiKey: 'test-api-key',
  })),
}))

describe('generateMDX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle errors gracefully', async () => {
    const options = {
      type: 'https://schema.org/Article',
      // Missing content intentionally to trigger error
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
