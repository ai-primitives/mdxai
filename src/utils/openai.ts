import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV1 } from '@ai-sdk/provider'

// Configure OpenAI client with gateway support
export const openAIClient = createOpenAICompatible({
  baseURL: process.env.AI_GATEWAY || 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  name: 'openai'
})

// Default model configuration with consistent settings
export const defaultModel: LanguageModelV1 = openAIClient('gpt-4o-mini', {
  maxTokens: 100, // Enforce token limit for faster test execution
  temperature: 0.7 // Consistent temperature for reliable outputs
})
