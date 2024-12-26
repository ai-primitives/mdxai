import type { ProgressCallback } from './index.js'

export interface AIConfig {
  apiKey?: string
  baseURL?: string
  workerToken?: string
  defaultModel?: string
}

export interface RuntimeConfig {
  aiConfig: AIConfig
  onProgress?: ProgressCallback
}

// Default configuration that works in any runtime
const defaultConfig: RuntimeConfig = {
  aiConfig: {
    defaultModel: 'gpt-4o-mini',
  },
}

// Get configuration based on runtime environment
export function getConfig(options?: Partial<RuntimeConfig>): RuntimeConfig {
  // Browser/Edge runtime - only use provided options
  if (typeof process === 'undefined') {
    return {
      ...defaultConfig,
      ...options,
      aiConfig: {
        ...defaultConfig.aiConfig,
        ...options?.aiConfig,
      },
    }
  }

  // Node.js runtime - merge environment variables
  return {
    ...defaultConfig,
    ...options,
    aiConfig: {
      ...defaultConfig.aiConfig,
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_GATEWAY,
      workerToken: process.env.CF_WORKERS_AI_TOKEN,
      defaultModel: process.env.AI_MODEL || defaultConfig.aiConfig.defaultModel,
      ...options?.aiConfig,
    },
  }
}

// Validate configuration
export function validateConfig(config: RuntimeConfig): void {
  if (!config.aiConfig.apiKey && !config.aiConfig.baseURL) {
    throw new Error('No AI provider configuration found. Set OPENAI_API_KEY or AI_GATEWAY environment variable.')
  }
}
