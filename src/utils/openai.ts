import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// Configure OpenAI client with gateway support
export const openAIClient = createOpenAICompatible({
  baseURL: process.env.AI_GATEWAY || 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  name: 'openai'
})

// Default model configuration
export const defaultModel = openAIClient('gpt-4o-mini')
