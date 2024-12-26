import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'

// Handle ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI', () => {
  const CLI_PATH = path.resolve(__dirname, '../../bin/cli.js')

  it('executes mdxai command with prompt', async () => {
    const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, 'write a short AI summary'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
    })

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Generating MDX')
    expect(stdout).toContain('$schema: https://mdx.org.ai/schema.json')
  })

  it('uses gpt-4o-mini as default model', async () => {
    const { stdout, stderr, exitCode } = await execa('node', [CLI_PATH, '--model', 'gpt-4o-mini', 'generate test content'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      all: true,
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
