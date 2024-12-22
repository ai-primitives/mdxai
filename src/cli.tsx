#!/usr/bin/env node
import React, { useState, useEffect } from 'react'
import { render } from 'ink'
import { Box, Text } from 'ink'
import meow from 'meow'
import { generateMDX } from './index.js'
import { glob } from 'glob'
import path from 'path'
import { fileURLToPath } from 'url'

interface CliGenerateOptions {
  type: string
  filepath?: string
  instructions?: string
  maxTokens?: number
  model?: string
  components?: string[]
}

const cli = meow(
  `
    Usage
      $ mdxai <filepath> <instructions...>
      $ mdxai <command> [options]

    Commands
      generate    Generate MDX content
      init       Initialize configuration

    Options
      --type     Schema type (default: https://schema.org/Article)
      --concurrency  Number of concurrent operations (default: 4)

    Examples
      $ mdxai blog/future-of-ai.mdx write a blog post about the future of AI
      $ mdxai blog/future-of-ai.mdx add more real-world examples from recent news
      $ mdxai content/**/* change the voice of the content to be more conversational
      $ mdxai generate ./content --type="https://schema.org/Article"
`,
  {
    importMeta: import.meta,
    flags: {
      type: {
        type: 'string',
        default: 'https://schema.org/Article',
      },
      concurrency: {
        type: 'number',
        default: 4,
      },
      maxTokens: {
        type: 'number',
        default: 100,
      },
      model: {
        type: 'string',
        default: 'gpt-4o-mini',
      },
      components: {
        type: 'string',
      },
    },
  },
)

interface ProcessingStatus {
  total: number
  completed: number
  current: string
  error?: string
}

export const App = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, completed: 0, current: 'Processing' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCommand = async () => {
      try {
        // Split input into command/filepath and remaining args
        const [firstArg, ...remainingArgs] = cli.input

        // Handle generate command
        if (firstArg === 'generate' || (!firstArg && cli.flags.type)) {
          setStatus((prev) => ({ ...prev, current: 'Processing' }))
          await generateMDX({
            type: cli.flags.type,
            maxTokens: cli.flags.maxTokens || 100,
            model: 'gpt-4o-mini',
            components: typeof cli.flags.components === 'string' ? cli.flags.components.split(',') : undefined,
          } as CliGenerateOptions)
          setStatus((prev) => ({ ...prev, current: 'Generation complete!' }))
          return
        }

        // Handle init command
        if (firstArg === 'init') {
          setStatus((prev) => ({ ...prev, current: 'Processing' }))
          // TODO: Implement init logic
          setStatus((prev) => ({ ...prev, current: 'Generation complete!' }))
          return
        }

        // Handle direct filepath + instructions pattern
        if (firstArg && !firstArg.startsWith('-')) {
          const filepath = firstArg
          // Join all remaining args as the instructions
          const instructions = remainingArgs.join(' ')

          if (!instructions) {
            setError('Instructions are required when processing files')
            return
          }

          if (filepath.includes('*')) {
            // Handle glob pattern
            const files = await glob(filepath, { absolute: false })
            if (!files.length) {
              setError(`No files found matching pattern: ${filepath}`)
              return
            }

            setStatus((prev) => ({ ...prev, total: files.length, current: 'Processing multiple files' }))

            // Process files concurrently with limit
            const chunks: string[][] = []
            for (let i = 0; i < files.length; i += cli.flags.concurrency) {
              chunks.push(files.slice(i, i + cli.flags.concurrency))
            }

            for (const chunk of chunks) {
              await Promise.all(
                chunk.map(async (file: string) => {
                  setStatus((prev) => ({ ...prev, current: `Processing ${file}` }))
                  await generateMDX({
                    type: cli.flags.type,
                    filepath: file,
                    instructions,
                    maxTokens: cli.flags.maxTokens || 100,
                    model: 'gpt-4o-mini',
                  } as CliGenerateOptions)
                  setStatus((prev) => ({
                    ...prev,
                    completed: prev.completed + 1,
                    current: `Completed ${prev.completed + 1}/${prev.total} files`,
                  }))
                }),
              )
            }
            return
          }

          // Handle single file
          setStatus((prev) => ({ ...prev, current: `Processing ${filepath}` }))
          await generateMDX({
            type: cli.flags.type,
            filepath,
            instructions,
            maxTokens: cli.flags.maxTokens || 100,
            model: 'gpt-4o-mini',
          } as CliGenerateOptions)
          setStatus((prev) => ({ ...prev, current: 'Generation complete!' }))
          return
        }

        // Handle unknown command
        if (firstArg) {
          setError('Unknown command. Run mdxai --help for usage information.')
        } else {
          setError('No command provided. Run mdxai --help for usage information.')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      }
    }

    handleCommand()
  }, [])

  return (
    <Box flexDirection='column'>
      {error ? (
        <Text color='red'>{error}</Text>
      ) : (
        <Box>
          <Text>
            {status.current}
            {status.total > 0 && ` (${status.completed}/${status.total})`}
          </Text>
        </Box>
      )}
    </Box>
  )
}

// Only render if this file is being run directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''))) {
  render(<App />)
}
