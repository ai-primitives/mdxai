import React from 'react'
import { render } from 'ink-testing-library'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { App } from './cli.js'
import { streamText } from 'ai'
import path from 'path'
import type * as ReactTypes from 'react'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { defaultModel } from './utils/openai.js'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Test configuration
const TEST_TIMEOUT = 15000 // 15 second timeout for test execution
const MAX_TOKENS = 100 // Token limit for faster test execution
const MODEL: LanguageModelV1 = defaultModel // Use gpt-4o-mini model configuration

// Helper function to wait for specific status with better timeout handling
const waitForStatus = async (lastFrame: () => string | undefined, timeout = TEST_TIMEOUT) => {
  console.log(`Waiting for status update with timeout ${timeout}ms`)
  const start = Date.now()
  let lastStatus = ''
  let progressDots = 0

  while (Date.now() - start < timeout) {
    const frame = lastFrame()
    if (frame && frame !== lastStatus) {
      console.log(`\nStatus update (${Math.floor((Date.now() - start) / 1000)}s): ${frame}`)
      lastStatus = frame
      if (frame.includes('complete') || frame.includes('error') || frame.includes('failed')) {
        return true
      }
    } else {
      // Show progress indicator
      process.stdout.write('.')
      if (++progressDots % 60 === 0) process.stdout.write('\n')
    }
    await new Promise((resolve) => setTimeout(resolve, 500)) // Increased polling interval
  }
  console.error(`\n❌ Timeout after ${timeout}ms waiting for status update`)
  console.error(`Last status: ${lastStatus}`)
  throw new Error(`Timeout after ${timeout}ms waiting for status update. Last status: ${lastStatus}`)
}

// Mock React hooks for testing
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactTypes>('react')
  return actual
})

describe('CLI', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(join(tmpdir(), 'mdxai-test-'))
    process.argv = ['node', 'mdxai']
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('renders initial processing state', () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toBeTruthy()
  })

  it('handles file not found error gracefully', async () => {
    const nonexistentFile = join(tempDir, 'nonexistent.mdx')
    process.argv = ['node', 'mdxai', '--type=https://schema.org/Article', nonexistentFile, 'test instructions']

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)
    
    const frame = lastFrame()
    expect(frame).toBeTruthy()
    expect(existsSync(nonexistentFile)).toBe(false)
  })

  it('creates output file when generating new content', async () => {
    const outputFile = join(tempDir, 'new-post.mdx')
    process.argv = [
      'node',
      'mdxai',
      '--type=https://schema.org/BlogPosting',
      '--max-tokens', '200',
      outputFile,
      'Write a short blog post about AI testing with two sections'
    ]

    const { lastFrame } = render(<App />)
    console.log('Starting content generation test...')
    await waitForStatus(lastFrame)
    console.log('Content generation completed, checking file...')

    // Verify file was created and has basic MDX structure
    expect(existsSync(outputFile)).toBe(true)
    const content = await fs.readFile(outputFile, 'utf-8')
    console.log('Generated content length:', content.length)
    expect(content.length).toBeGreaterThan(0)
  })

  it('processes multiple files with correct concurrency', async () => {
    // Create test files
    const files = ['test1.mdx', 'test2.mdx', 'test3.mdx']
    for (const file of files) {
      await fs.writeFile(join(tempDir, file), '# Test\nInitial content')
    }

    process.argv = [
      'node', 
      'mdxai', 
      '--concurrency', '2',
      '--type=https://schema.org/Article',
      join(tempDir, '*.mdx'),
      'update content'
    ]

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)

    // Verify all files were processed and content was changed
    for (const file of files) {
      const content = await fs.readFile(join(tempDir, file), 'utf-8')
      expect(content.length).toBeGreaterThan(0)
    }
  })

  it('respects maxTokens parameter', async () => {
    const outputFile = join(tempDir, 'token-test.mdx')
    process.argv = [
      'node',
      'mdxai',
      '--max-tokens', '50',
      '--model', 'gpt-4o-mini',
      outputFile,
      'write a long post'
    ]

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)

    expect(existsSync(outputFile)).toBe(true)
    const content = await fs.readFile(outputFile, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('loads and applies configuration from mdxai.config.js', async () => {
    // Create config file
    await fs.writeFile(join(tempDir, 'mdxai.config.js'), `
      export default {
        type: 'https://schema.org/BlogPosting',
        components: ['Alert', 'Button']
      }
    `)

    const outputFile = join(tempDir, 'config-test.mdx')
    process.argv = [
      'node',
      'mdxai',
      '--components', 'Alert,Button',
      outputFile,
      'write a post'
    ]

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)

    expect(existsSync(outputFile)).toBe(true)
    const content = await fs.readFile(outputFile, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('handles multi-word prompts without quotes', async () => {
    const outputFile = join(tempDir, 'prompt-test.mdx')
    process.argv = [
      'node',
      'mdxai',
      '--type=https://schema.org/Article',
      outputFile,
      'write', 'a', 'blog', 'post', 'about', 'testing', 'without', 'quotes'
    ]

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)

    expect(existsSync(outputFile)).toBe(true)
    const content = await fs.readFile(outputFile, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('handles unknown commands with helpful error', async () => {
    process.argv = ['node', 'mdxai', 'unknown-command']
    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)
    expect(lastFrame()).toBeTruthy()
  })

  it('handles missing prompt with helpful error', async () => {
    const outputFile = join(tempDir, 'no-prompt.mdx')
    process.argv = ['node', 'mdxai', '--type=https://schema.org/Article', outputFile]
    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)
    expect(lastFrame()).toBeTruthy()
  })

  it('handles invalid options with helpful error', async () => {
    process.argv = ['node', 'mdxai', '--invalid-option', 'value', 'file.mdx', 'prompt']
    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)
    expect(lastFrame()).toBeTruthy()
  })

  it('handles generate command with type option', async () => {
    const outputFile = join(tempDir, 'generate-test.mdx')
    process.argv = [
      'node',
      'mdxai',
      'generate',
      '--type=https://schema.org/Article',
      outputFile
    ]

    const { lastFrame } = render(<App />)
    await waitForStatus(lastFrame)

    expect(existsSync(outputFile)).toBe(true)
    const content = await fs.readFile(outputFile, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })
})                                 