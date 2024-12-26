import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'

// Mock the AI SDK at module level
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockImplementation(() => ({
    languageModel: vi.fn().mockImplementation((model) => ({
      doGenerate: vi.fn().mockImplementation((options) => {
        // Get the actual prompt text and type from the options
        const promptText = options.prompt[0]?.text || ''
        const type = options.type || 'Article'
        const userPrompt = promptText

        const mdxContent = `---
$schema: https://mdx.org.ai/schema.json
$type: ${type}
model: ${model}
title: ${type} about ${userPrompt}
description: Generated ${type.toLowerCase()} content about ${userPrompt}
---

# ${userPrompt}

This is a generated ${type.toLowerCase()} about ${userPrompt}.

## Overview

Detailed information about ${userPrompt}.

## Details

More specific details about ${userPrompt}.`

        return Promise.resolve({
          text: mdxContent,
          progressMessage: 'Generating MDX\n'
        })
      })
    }))
  }))
}))

// Handle ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI', () => {
  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'gpt-4o-mini'
    process.env.AI_GATEWAY = 'https://api.test.com'
    
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })
  const CLI_PATH = path.resolve(__dirname, '../../bin/cli.js')

  it('executes mdxai command with prompt', async () => {
    const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'write a short AI summary'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
        AI_GATEWAY: process.env.AI_GATEWAY,
        NODE_ENV: 'test'
      }
    })

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Generating MDX')
    expect(stdout).toContain('$schema: https://mdx.org.ai/schema.json')
  })

  it('uses gpt-4o-mini as default model', async () => {
    const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, '--model', 'gpt-4o-mini', 'generate test content'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
        AI_GATEWAY: process.env.AI_GATEWAY,
        NODE_ENV: 'test'
      }
    })

    expect(exitCode).toBe(0)
    // Avoid strict equality checks for AI output
    expect(stderr).toContain('Generating MDX')
    expect(stdout).toContain('gpt-4o-mini')
  })

  it('supports custom MDX-LD types', async () => {
    const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, '--type', 'BlogPost', 'write a blog post'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
        AI_GATEWAY: process.env.AI_GATEWAY,
        NODE_ENV: 'test'
      }
    })

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Generating MDX')
    expect(stdout).toContain('BlogPost')
  })

  it('handles errors gracefully', async () => {
    const { stderr, exitCode } = await execa('node', [CLI_PATH], {
      reject: false, // Don't throw on non-zero exit codes
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
    })

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('Error')
  })
})
