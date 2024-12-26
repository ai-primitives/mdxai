#!/usr/bin/env node

import { Command } from 'commander'
import { generateMDX } from '../index.js'
import { getConfig } from '../config.js'
import { ConfigurationError, GenerationError, ParsingError, formatError as formatErrorUtil } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import { readFile, writeFile } from '../utils/fs.js'

// CLI-specific utilities
// This function is used internally by the CLI
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const readInput = async (path?: string): Promise<string> => {
  if (!path) {
    return new Promise((resolve) => {
      let data = ''
      process.stdin.on('data', (chunk) => (data += chunk))
      process.stdin.on('end', () => resolve(data))
    })
  }
  return readFile(path)
}

const writeOutput = async (content: string, path?: string): Promise<void> => {
  if (!path) {
    process.stdout.write(content)
    return
  }
  await writeFile(path, content)
}

export async function cli() {
  const program = new Command()

  // Override default error handling
  // Configure Commander's output handling
  // Configure Commander's output handling
  // Configure error handling first
  program.showHelpAfterError(false)

  // Configure error handling
  const formatError = (error: unknown): string => {
    if (error instanceof ConfigurationError || error instanceof GenerationError || error instanceof ParsingError) {
      return formatErrorUtil(error)
    }
    if (error instanceof Error) {
      return `Error: ${error.message}`
    }
    const msg = String(error)
    if (!msg) return ''
    const cleaned = msg
      .trim()
      .replace(/^error:\s*/i, '')
      .replace(/^Error:\s*/i, '')
    return `Error: ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}`
  }

  // Configure output handling using logger
  const writeToStderr = (msg: string): void => {
    logger.error(msg)
  }

  // Disable built-in error handling
  program.showHelpAfterError(false)
  program.configureHelp({
    helpWidth: 80,
    sortSubcommands: true,
    sortOptions: true,
  })

  // Configure Commander output
  program.configureOutput({
    writeOut: (str: string) => process.stdout.write(str),
    writeErr: (str: string) => {
      if (str.toLowerCase().includes('error')) {
        writeToStderr(formatError(str))
      } else {
        writeToStderr(str)
      }
    },
  })

  // Handle all errors consistently
  program.exitOverride((err: Error & { code?: string }) => {
    const errorMessage = err.code === 'commander.missingArgument' ? formatError("Missing required argument 'prompt'") : formatError(err.message)
    writeToStderr(errorMessage)
    process.exit(1)
  })

  program
    .name('mdxai')
    .description('Zero-config CLI to generate and update MDX structured data')
    .argument('<prompt>', 'Prompt for generating MDX content')
    .option('--model <model>', 'AI model to use (default: uses AI_MODEL env var)')
    .option('--type <type>', 'MDX-LD type (default: Article)')
    .option('-r, --recursive', 'Enable recursive generation with outline', false)
    .option('-d, --depth <depth>', 'Maximum recursion depth for outline generation', '1')
    .action(async (prompt, options) => {
      try {
        const config = getConfig({
          aiConfig: {
            defaultModel: options.model,
          },
        })
        const type = options.type || 'Article'
        const recursive = options.recursive || false
        const depth = parseInt(options.depth || '1', 10)

        try {
          // Generate content
          const { content } = await generateMDX({
            prompt,
            model: config.aiConfig.defaultModel,
            type,
            recursive,
            depth,
            onProgress: (progress, message) => {
              process.stderr.write(`\rGenerating MDX (${progress}% complete) - ${message}`)
              if (progress === 100) {
                process.stderr.write('\n')
              }
            },
          })

          // Write progress message to stderr for immediate feedback
          writeToStderr('Generating MDX\n')

          // Write content using fs utility
          await writeOutput(content + '\n')
        } catch (error) {
          // Handle specific error types
          if (error instanceof ConfigurationError || error instanceof GenerationError || error instanceof ParsingError) {
            writeToStderr(formatError(error))
          } else {
            // Write detailed error to stderr for debugging
            const errorMessage =
              error instanceof Error
                ? `Failed to generate MDX content: ${error.message}\nStack: ${error.stack}`
                : 'Failed to generate MDX content: Unknown error'
            writeToStderr(formatError(errorMessage))
          }
          process.exit(1)
        }
      } catch {
        writeToStderr(formatError('Invalid input'))
        process.exit(1)
      }
    })

  try {
    await program.parseAsync(process.argv)
  } catch {
    process.exit(1)
  }
}
