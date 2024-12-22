#!/usr/bin/env node
import React, { useState, useEffect } from 'react'
import { render } from 'ink'
import meow from 'meow'
import Spinner from 'ink-spinner'
import TextInput from 'ink-text-input'
import { Box, Text } from 'ink'
import { generateMDX } from './index.js'

const cli = meow(`
    Usage
      $ mdxai <command> [options]

    Commands
      generate    Generate MDX content
      init       Initialize configuration

    Options
      --type     Schema type
      --concurrency  Number of concurrent operations

    Examples
      $ mdxai generate ./content --type="https://schema.org/Article"
`)

export const App = () => {
  const [status, setStatus] = useState('Processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const command = cli.input[0]
    const options = cli.flags

    const handleCommand = async () => {
      try {
        if (command === 'generate') {
          setStatus('Generating MDX content...')
          await generateMDX({
            type: (options.type as string) || 'https://schema.org/Article'
          })
          setStatus('Generation complete!')
        } else if (command === 'init') {
          setStatus('Initializing configuration...')
          // TODO: Implement init logic
          setStatus('Initialization complete!')
        } else {
          setError('Unknown command')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      }
    }

    handleCommand()
  }, [])

  return (
    <Box flexDirection="column">
      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Text>
          <Spinner type="dots" /> {status}
        </Text>
      )}
    </Box>
  )
}

// Only render if this file is being run directly
if (require.main === module) {
  render(<App />)
}
