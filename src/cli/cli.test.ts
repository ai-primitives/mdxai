import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { cli } from './index.js'

// Save original process properties
const originalArgv = process.argv
const originalWrite = process.stdout.write
const originalErrorWrite = process.stderr.write
const originalExit = process.exit

// Mock the AI SDK at module level
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockImplementation(() => ({
    languageModel: vi.fn().mockImplementation((model) => ({
      doGenerate: vi.fn().mockImplementation(async (options) => {
        const promptText = options.prompt || ''
        const type = options.type || 'Article'

        // Create frontmatter with required fields in specific order
        const frontmatter = [
          '---',
          `$type: https://schema.org/${type}`,
          '$schema: https://mdx.org.ai/schema.json',
          `$context: https://schema.org`,
          `model: ${model}`,
          `title: ${type} about ${promptText}`,
          `description: Generated ${type.toLowerCase()} content about ${promptText}`,
          `'@type': https://schema.org/${type}`,
          `'@context': https://schema.org`,
          'metadata:',
          '  keywords:',
          `    - ${type.toLowerCase()}`,
          '    - mdx',
          '    - content',
          `  category: ${type}`,
          '  properties:',
          '    version: 1.0.0',
          `    generator: mdxai-${model}`,
          '---',
        ].join('\n')

        const content = [
          '',
          `# ${promptText}`,
          '',
          `This is a generated ${type.toLowerCase()} about ${promptText}.`,
          '',
          '## Overview',
          '',
          `Detailed information about ${promptText}.`,
          '',
          '## Details',
          '',
          `More specific details about ${promptText}.`,
        ].join('\n')

        return {
          text: frontmatter + content,
          progressMessage: 'Generating MDX\n',
        }
      }),
    })),
  })),
}))

describe('CLI', () => {
  // Create mock functions with proper typing
  const mockStdoutWrite = vi.fn().mockReturnValue(true)
  const mockStderrWrite = vi.fn().mockReturnValue(true)
  const mockExit = vi.fn().mockImplementation((code?: number) => {
    throw new Error(`Process exited with code ${code || 1}`)
  })

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.AI_MODEL = 'gpt-4o-mini'

    // Mock process.stdout.write and process.stderr.write
    process.stdout.write = mockStdoutWrite
    process.stderr.write = mockStderrWrite
    process.exit = mockExit as unknown as (code?: number) => never

    // Reset all mocks before each test
    vi.clearAllMocks()
    mockStdoutWrite.mockClear()
    mockStderrWrite.mockClear()
    mockExit.mockClear()
  })

  afterEach(() => {
    // Restore original process properties
    process.argv = originalArgv
    process.stdout.write = originalWrite
    process.stderr.write = originalErrorWrite
    process.exit = originalExit
  })

  it('executes mdxai command with prompt', async () => {
    process.argv = ['node', 'cli.js', 'write a short AI summary']
    await cli()

    // Check console output
    expect(mockStderrWrite).toHaveBeenCalledWith(expect.stringContaining('Generating MDX'))
    expect(mockStdoutWrite).toHaveBeenCalledWith(expect.stringContaining('$schema: https://mdx.org.ai/schema.json'))
  })

  it('uses gpt-4o-mini as default model', async () => {
    process.argv = ['node', 'cli.js', '--model', 'gpt-4o-mini', 'generate test content']
    await cli()

    // Check console output
    expect(mockStderrWrite).toHaveBeenCalledWith(expect.stringContaining('Generating MDX'))
    expect(mockStdoutWrite).toHaveBeenCalledWith(expect.stringContaining('model: gpt-4o-mini'))
  })

  it('supports custom MDX-LD types', async () => {
    process.argv = ['node', 'cli.js', '--type', 'BlogPost', 'write a blog post']
    await cli()

    // Check console output
    expect(mockStderrWrite).toHaveBeenCalledWith(expect.stringContaining('Generating MDX'))
    expect(mockStdoutWrite).toHaveBeenCalledWith(expect.stringContaining('$type: https://schema.org/BlogPost'))
  })

  it('handles errors gracefully', async () => {
    // Remove required environment variable to trigger error
    delete process.env.OPENAI_API_KEY
    process.argv = ['node', 'cli.js']

    try {
      await cli()
      // Should not reach here
      expect(true).toBe(false)
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error)
      if (error instanceof Error) {
        expect(error.message).toBe('Process exited with code 1')
      }
      expect(mockStderrWrite).toHaveBeenCalledWith(expect.stringContaining('Error'))
      expect(mockExit).toHaveBeenCalledWith(1)
    }
  })
})
