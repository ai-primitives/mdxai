import { describe, it, expect, vi } from 'vitest'
import { getConfig } from '../config.js'
import { getLogger } from '../utils/logger.js'
import { MDXAIError, ConfigurationError, GenerationError, ParsingError } from '../utils/errors.js'

// Type declarations for runtime tests
interface ProcessEnv {
  [key: string]: string | undefined
}

interface RuntimeProcess {
  env: ProcessEnv
  stdout: {
    write: (message: string) => boolean
  }
  stderr: {
    write: (message: string) => boolean
  }
  versions?: {
    node?: string
  }
}

interface TestGlobal {
  process: RuntimeProcess | undefined
}

// Declare test environment types
declare const process: RuntimeProcess
declare var globalThis: TestGlobal

// Helper function for type-safe process access
function getGlobalProcess(): RuntimeProcess | undefined {
  return globalThis.process
}

describe('Runtime Compatibility', () => {
  describe('Configuration', () => {
    it('should handle browser/edge runtime without process.env', () => {
      // Mock browser environment
      const processBackup = getGlobalProcess()
      // Intentionally removing process for testing
      globalThis.process = undefined

      const config = getConfig()
      expect(config.aiConfig.defaultModel).toBe('gpt-4o-mini')
      expect(config.aiConfig.apiKey).toBeUndefined()
      expect(config.aiConfig.baseURL).toBeUndefined()

      // Restore process
      globalThis.process = processBackup
    })

    it('should handle Node.js runtime with process.env', () => {
      const envBackup = process.env
      process.env = {
        ...process.env,
        OPENAI_API_KEY: 'test-key',
        AI_GATEWAY: 'test-url',
        AI_MODEL: 'test-model',
      }

      const config = getConfig()
      expect(config.aiConfig.apiKey).toBe('test-key')
      expect(config.aiConfig.baseURL).toBe('test-url')
      expect(config.aiConfig.defaultModel).toBe('test-model')

      // Restore environment
      process.env = envBackup
    })
  })

  describe('Logging', () => {
    it('should provide no-op logger in browser/edge runtime', () => {
      // Mock browser environment
      const processBackup = getGlobalProcess()
      // Intentionally removing process for testing
      globalThis.process = undefined

      const logger = getLogger()
      const consoleSpy = vi.spyOn(console, 'log')

      logger.info('test')
      expect(consoleSpy).not.toHaveBeenCalled()

      // Restore process
      globalThis.process = processBackup
      consoleSpy.mockRestore()
    })

    it('should provide console logger in Node.js runtime', () => {
      const logger = getLogger()
      const stdoutSpy = vi.spyOn(process.stdout, 'write')
      const stderrSpy = vi.spyOn(process.stderr, 'write')

      logger.info('test')
      expect(stdoutSpy).toHaveBeenCalledWith('test\n')

      logger.error('error test')
      expect(stderrSpy).toHaveBeenCalledWith('error test\n')

      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle errors consistently across runtimes', () => {
      const error = new MDXAIError('test error')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(MDXAIError)
      expect(error.name).toBe('MDXAIError')
      expect(error.message).toBe('test error')
    })

    it('should handle specific error types', () => {
      const configError = new ConfigurationError('config error')
      expect(configError).toBeInstanceOf(MDXAIError)
      expect(configError.name).toBe('ConfigurationError')
      expect(configError.message).toBe('Configuration Error: config error')

      const genError = new GenerationError('gen error')
      expect(genError).toBeInstanceOf(MDXAIError)
      expect(genError.name).toBe('GenerationError')
      expect(genError.message).toBe('Generation Error: gen error')

      const parseError = new ParsingError('parse error')
      expect(parseError).toBeInstanceOf(MDXAIError)
      expect(parseError.name).toBe('ParsingError')
      expect(parseError.message).toBe('Parsing Error: parse error')
    })
  })
})
