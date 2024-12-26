#!/usr/bin/env node

import { Command } from 'commander'
import { generateMDX } from '../index.js'

export async function cli() {
  const program = new Command()

  // Override default error handling
  // Configure Commander's output handling
  // Configure Commander's output handling
  // Configure error handling first
  program.showHelpAfterError(false)

  // Configure error handling
  const formatError = (msg: string): string => {
    if (!msg) return ''
    const cleaned = msg
      .trim()
      .replace(/^error:\s*/i, '')
      .replace(/^Error:\s*/i, '')
    return `Error: ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}`
  }

  // Configure output handling
  const writeToStderr = (msg: string): void => {
    process.stderr.write(msg + '\n')
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
        const model = options.model || process.env.AI_MODEL || 'gpt-4o-mini'
        const type = options.type || 'Article'
        const recursive = options.recursive || false
        const depth = parseInt(options.depth || '1', 10)

        try {
          // Generate content
          const { content, progressMessage } = await generateMDX({
            prompt,
            model,
            type,
            recursive,
            depth,
          })

          // Write progress message to stderr for immediate feedback
          writeToStderr(progressMessage)

          // Write progress message to stderr for immediate feedback
          writeToStderr('Generating MDX')
          // Write content to stdout for piping
          process.stdout.write(content)
        } catch {
          writeToStderr(formatError('Failed to generate MDX content'))
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
