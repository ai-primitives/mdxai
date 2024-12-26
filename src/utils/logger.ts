/**
 * Runtime-agnostic logging utility
 */

export interface Logger {
  info: (message: string) => void
  error: (message: string) => void
  warn: (message: string) => void
  debug: (message: string) => void
}

// Default no-op logger for browser/edge environments
const defaultLogger: Logger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
}

// Node.js console logger
const nodeLogger: Logger = {
  info: (message: string) => process.stdout.write(`${message}\n`),
  error: (message: string) => process.stderr.write(`${message}\n`),
  warn: (message: string) => process.stderr.write(`Warning: ${message}\n`),
  debug: (message: string) => process.stdout.write(`Debug: ${message}\n`),
}

// Runtime detection with proper type checking
function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process?.versions?.node !== undefined && typeof process.env === 'object'
}

// Get appropriate logger based on runtime
export function getLogger(): Logger {
  return isNodeRuntime() ? nodeLogger : defaultLogger
}

// Export singleton instance
export const logger = getLogger()
