import React from 'react'
import { render } from 'ink-testing-library'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from './cli.js'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import path from 'path'

const model = openai('gpt-4')

// Mock React hooks for testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
    useEffect: vi.fn((fn) => fn()),
  }
})

describe('CLI', () => {
  beforeEach(() => {
    // Clear process.argv and reset mocks before each test
    process.argv = ['node', 'mdxai']
    vi.clearAllMocks()
  })

  it('renders initial processing state', () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toContain('Initializing')
  })

  it('handles basic MDX generation with filepath and instructions', async () => {
    const filepath = 'blog/future-of-ai.mdx'
    const instructions = 'write a blog post about the future of AI'
    process.argv = ['node', 'mdxai', filepath, instructions]
    
    const { lastFrame } = render(<App />)
    
    // Wait for generation to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Initializing')
    // Verify the correct filepath was processed
    expect(lastFrame()).toContain(filepath)
  })

  it('handles editing existing MDX content', async () => {
    const filepath = 'blog/future-of-ai.mdx'
    const instructions = 'add more real-world examples from recent news'
    process.argv = ['node', 'mdxai', filepath, instructions]
    
    const { lastFrame } = render(<App />)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Generation complete')
    expect(lastFrame()).toContain(filepath)
  })

  it('handles glob pattern for multiple files', async () => {
    const globPattern = 'content/**/*'
    const instructions = 'change the voice of the content to be more conversational'
    process.argv = ['node', 'mdxai', globPattern, instructions]
    
    const { lastFrame } = render(<App />)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Processing multiple files')
    expect(lastFrame()).toContain('Generation complete')
  })

  it('generates MDX content with proper frontmatter and schema', async () => {
    const filepath = 'blog/test-article.mdx'
    const instructions = 'write a technical article about testing'
    process.argv = ['node', 'mdxai', filepath, instructions]
    
    const { lastFrame } = render(<App />)
    
    const { text, finishReason, usage } = await streamText({
      model,
      system: 'You are an expert MDX content generator. Generate MDX content that follows https://schema.org/Article schema.',
      prompt: instructions,
      maxTokens: 2000,
    })

    // Verify the generated content structure
    expect(text).toBeTruthy()
    expect(typeof text).toBe('string')
    expect(text.toString()).toMatch(/^---/) // Has frontmatter
    expect(text.toString()).toMatch(/\$type: https:\/\/schema\.org\/Article/) // Has schema type
    expect(text.toString()).toMatch(/title: .+/) // Has a title
    expect(text.toString()).toMatch(/description: .+/) // Has a description
    expect(text.toString()).toMatch(/---\s*\n/) // Ends frontmatter
    expect(text.toString()).toMatch(/^#\s+\w+/m) // Has a heading
    
    expect(finishReason).toBe('stop')
    expect(usage).toHaveProperty('totalTokens')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Initializing')
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
    
    const { text, finishReason, usage } = await streamText({
      model,
      system: 'You are an expert MDX content generator. Generate MDX content that follows https://schema.org/Article schema.',
      prompt: 'Generate an article about AI testing.',
      maxTokens: 2000,
    })

    // Verify the generated content
    expect(text).toBeTruthy()
    expect(typeof text).toBe('string')
    expect(text.toString()).toMatch(/^---/) // Should have frontmatter
    expect(text.toString()).toMatch(/\$type: https:\/\/schema\.org\/Article/) // Should have schema type
    expect(text.toString()).toMatch(/---\s*\n/) // Should end frontmatter
    expect(text.toString()).toMatch(/^#\s+\w+/m) // Should have a heading
    
    // Verify the generation completed successfully
    expect(finishReason).toBe('stop')
    expect(usage).toHaveProperty('totalTokens')
    
    // Verify the CLI output
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(lastFrame()).toContain('Initializing')
  })
}) 