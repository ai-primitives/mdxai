#!/usr/bin/env node
import React, { useEffect, useState } from 'react'
import { render } from 'ink'
import { Box, Text } from 'ink'
import meow from 'meow'
import { generateMDX, GenerateOptions } from './index.js'
import { glob } from 'glob'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

type ProcessingStatus = {
  total: number
  completed: number
  current: string
}

const validateFile = async (filepath: string) => {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`)
  }
}

const ensureDirectoryExists = async (filepath: string) => {
  const dir = dirname(filepath)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

const cli = meow(`
  Usage
    $ mdxai [options] <file> <prompt>
    $ mdxai generate [options] <file>
    $ mdxai init

  Options
    --type         Schema.org type for the content (default: https://schema.org/Article)
    --concurrency  Number of files to process concurrently (default: 2)
    --maxTokens    Maximum number of tokens to generate
    --model        Model to use for generation
    --components   Comma-separated list of components to use

  Examples
    $ mdxai --type="https://schema.org/BlogPosting" blog/future-of-ai.mdx write a blog post about the future of AI
    $ mdxai --max-tokens 200 blog/future-of-ai.mdx add more real-world examples from recent news
    $ mdxai --concurrency 4 content/**/* change the voice of the content to be more conversational
    $ mdxai generate --type="https://schema.org/Article" ./content
`, {
  importMeta: import.meta,
  flags: {
    type: {
      type: 'string',
      default: 'https://schema.org/Article',
    },
    concurrency: {
      type: 'number',
      default: 2,
    },
    maxTokens: {
      type: 'number',
    },
    model: {
      type: 'string',
    },
    components: {
      type: 'string',
    },
  },
  argv: process.argv.slice(2),
})

export const App = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, completed: 0, current: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCommand = async () => {
      try {
        // Handle unknown flags first
        const unknownFlags = Object.keys(cli.flags).filter(flag => 
          !['type', 'concurrency', 'maxTokens', 'model', 'components'].includes(flag)
        )
        if (unknownFlags.length) {
          setError(`Unknown option(s): ${unknownFlags.join(', ')}`)
          return
        }

        // Handle generate command
        if (cli.input[0] === 'generate') {
          if (!cli.input[1]) {
            setError('Output file is required for generate command')
            return
          }

          const outputFile = cli.input[1]
          try {
            await ensureDirectoryExists(dirname(outputFile))
            setStatus(prev => ({ ...prev, current: 'Processing' }))
            
            const result = await generateMDX({
              type: cli.flags.type,
              filepath: outputFile,
              maxTokens: cli.flags.maxTokens,
              model: cli.flags.model,
              components: cli.flags.components?.split(','),
            })
            
            await writeFile(outputFile, result.text)
            setStatus(prev => ({ ...prev, current: 'Generation complete!' }))
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate content')
          }
          return
        }

        // Handle init command
        if (cli.input[0] === 'init') {
          setError('Init command not implemented yet')
          return
        }

        // Handle direct filepath + prompt pattern
        if (cli.input[0]) {
          const filepath = cli.input[0]
          const prompt = cli.input.slice(1).join(' ')

          if (!prompt) {
            setError('Prompt is required when processing files')
            return
          }

          if (filepath.includes('*')) {
            // Handle glob pattern
            const files = await glob(filepath, { absolute: false })
            if (!files.length) {
              setError(`No files found matching pattern: ${filepath}`)
              return
            }

            try {
              setStatus(prev => ({ ...prev, total: files.length, current: 'Processing multiple files' }))

              // Process files concurrently with limit
              const chunks: string[][] = []
              for (let i = 0; i < files.length; i += cli.flags.concurrency) {
                chunks.push(files.slice(i, i + cli.flags.concurrency))
              }

              for (const chunk of chunks) {
                await Promise.all(
                  chunk.map(async (file: string) => {
                    try {
                      if (!existsSync(file)) {
                        throw new Error(`File not found: ${file}`)
                      }

                      setStatus(prev => ({ ...prev, current: `Processing ${file}` }))
                      
                      const content = await readFile(file, 'utf-8')
                      const result = await generateMDX({
                        type: cli.flags.type,
                        filepath: file,
                        instructions: prompt,
                        maxTokens: cli.flags.maxTokens,
                        model: cli.flags.model,
                        content,
                      })
                      
                      await writeFile(file, result.text)
                      
                      setStatus(prev => ({
                        ...prev,
                        completed: prev.completed + 1,
                        current: `Completed ${prev.completed + 1}/${prev.total} files`,
                      }))
                    } catch (err) {
                      if (err instanceof Error && err.message.includes('ENOENT')) {
                        setError(`File not found: ${file}`)
                      } else {
                        setError(err instanceof Error ? err.message : `Failed to process file: ${file}`)
                      }
                    }
                  }),
                )
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to process files')
            }
            return
          }

          // Handle single file
          try {
            // For new files, ensure directory exists
            await ensureDirectoryExists(dirname(filepath))
            setStatus(prev => ({ ...prev, current: `Processing ${filepath}` }))
            
            let content = ''
            if (existsSync(filepath)) {
              content = await readFile(filepath, 'utf-8')
            }

            const result = await generateMDX({
              type: cli.flags.type,
              filepath,
              instructions: prompt,
              maxTokens: cli.flags.maxTokens,
              model: cli.flags.model,
              content,
            })
            
            await writeFile(filepath, result.text)
            
            setStatus(prev => ({ ...prev, current: 'Generation complete!' }))
          } catch (err) {
            if (err instanceof Error && err.message.includes('ENOENT')) {
              setError(`File not found: ${filepath}`)
            } else {
              setError(err instanceof Error ? err.message : 'Failed to process file')
            }
          }
          return
        }

        // Handle unknown command or no command
        if (cli.input.length === 0) {
          setError('No command provided. Run mdxai --help for usage information.')
        } else {
          setError(`Unknown command: ${cli.input[0]}. Run mdxai --help for usage information.`)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      }
    }

    handleCommand()
  }, [])

  if (error) {
    return (
      <Box flexDirection='column'>
        <Text color='red'>{error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection='column'>
      <Text>
        {status.current || 'Processing...'}
        {status.total > 0 && ` (${status.completed}/${status.total})`}
      </Text>
    </Box>
  )
}

// Only render if this file is being run directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''))) {
  render(<App />)
}
