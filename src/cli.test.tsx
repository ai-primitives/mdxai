import React from 'react'
import { render } from 'ink-testing-library'
import { describe, it, expect, beforeEach } from 'vitest'
import { App } from './cli.js'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const model = openai('gpt-4o')

describe('CLI', () => {
  beforeEach(() => {
    // Clear process.argv before each test
    process.argv = ['node', 'mdxai']
  })

  it('renders initial processing state', () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toContain('Processing')
  })

  it('handles generate command with type option', async () => {
    process.argv = ['node', 'mdxai', 'generate', '--type=https://schema.org/Article']
    
    const { lastFrame } = render(<App />)
    
    // Wait for the initial processing state
    expect(lastFrame()).toContain('Processing')
    
    // Wait for generation to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Generation complete')
  })

  it('handles init command', async () => {
    process.argv = ['node', 'mdxai', 'init']
    const { lastFrame } = render(<App />)
    
    // Wait for the initial processing state
    expect(lastFrame()).toContain('Processing')
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(lastFrame()).toContain('Initialization complete')
  })

  it('displays error for unknown command', async () => {
    process.argv = ['node', 'mdxai', 'unknown']
    const { lastFrame } = render(<App />)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(lastFrame()).toContain('Unknown command')
  })

  it('handles generate command with content', async () => {
    process.argv = ['node', 'mdxai', 'generate']
    const content = '# Test Content\nThis is some test content.'
    
    const { lastFrame } = render(<App />)
    
    // Wait for generation to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Generation complete')
  })

  it('handles generate command with multiple components', async () => {
    process.argv = ['node', 'mdxai', 'generate', '--components=Button,Card,Alert']
    
    const { lastFrame } = render(<App />)
    
    // Wait for generation to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Generation complete')
  })

  it('generates MDX content using AI SDK', async () => {
    process.argv = ['node', 'mdxai', 'generate', '--type=https://schema.org/Article']
    
    const { lastFrame } = render(<App />)
    
    // Test the actual AI SDK integration
    const { text, finishReason, usage } = await streamText({
      model,
      system: 'You are an expert MDX content generator. Generate MDX content that follows https://schema.org/Article schema.',
      prompt: 'Generate an article about AI testing.',
      maxTokens: 2000,
    })

    // Verify the generated content
    expect(text).toBeTruthy()
    expect(text).toMatch(/^---/) // Should have frontmatter
    expect(text).toMatch(/\$type: https:\/\/schema\.org\/Article/) // Should have schema type
    expect(text).toMatch(/---\s*\n/) // Should end frontmatter
    expect(text).toMatch(/^#\s+\w+/m) // Should have a heading
    
    // Verify the generation completed successfully
    expect(finishReason).toBe('stop')
    expect(usage).toHaveProperty('totalTokens')
    
    // Verify the CLI output
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Generation complete')
  })
}) 