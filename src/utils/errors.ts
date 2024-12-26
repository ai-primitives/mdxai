/**
 * Runtime-agnostic error handling utilities
 */

// Base error class for mdxai
export class MDXAIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MDXAIError'
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, MDXAIError.prototype)
  }
}

// Specific error types
export class ConfigurationError extends MDXAIError {
  constructor(message: string) {
    super(`Configuration Error: ${message}`)
    this.name = 'ConfigurationError'
  }
}

export class GenerationError extends MDXAIError {
  constructor(message: string) {
    super(`Generation Error: ${message}`)
    this.name = 'GenerationError'
  }
}

export class ParsingError extends MDXAIError {
  constructor(message: string) {
    super(`Parsing Error: ${message}`)
    this.name = 'ParsingError'
  }
}

// Error formatting utility
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}
