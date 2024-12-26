import type { ProgressCallback } from './index.js'

import { Logger, getLogger } from './utils/logger.js'
import { ConfigurationError } from './utils/errors.js'

export interface AIConfig {
  apiKey?: string
  baseURL?: string
  workerToken?: string
  defaultModel?: string
  logger?: Logger
}

export interface RuntimeConfig {
  aiConfig: AIConfig
  onProgress?: ProgressCallback
}

// Default configuration that works in any runtime
const defaultConfig: RuntimeConfig = {
  aiConfig: {
    defaultModel: 'gpt-4o-mini',
    logger: getLogger(),
  },
}

// Runtime detection with proper type checking
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process?.versions?.node !== undefined && typeof process.env === 'object'
}

// Get configuration based on runtime environment
export function getConfig(options?: Partial<RuntimeConfig>): RuntimeConfig {
  const runtime = isNodeRuntime()
  const logger = getLogger()

  // Browser/Edge runtime - only use provided options
  if (!runtime) {
    logger.debug('Configuring for browser/edge runtime')
    return {
      ...defaultConfig,
      ...options,
      aiConfig: {
        ...defaultConfig.aiConfig,
        ...options?.aiConfig,
        logger,
      },
    }
  }

  // Node.js runtime - merge environment variables
  logger.debug('Configuring for Node.js runtime')
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
      logger,
    },
  }
}

// Validate configuration
export function validateConfig(config: RuntimeConfig): void {
  if (!config.aiConfig.apiKey && !config.aiConfig.baseURL) {
    throw new ConfigurationError('No AI provider configuration found. Set OPENAI_API_KEY or AI_GATEWAY environment variable.')
  }
}
