import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cli } from '../cli/index.js'
import { generateMDX } from '../index.js'
import { GenerationError } from '../utils/errors.js'

vi.mock('../utils/fs.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  resolvePath: vi.fn(),
}))

vi.mock('../index.js', () => ({
  generateMDX: vi.fn(),
}))

describe('CLI', () => {
  const originalExit = process.exit
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.exit = vi.fn() as never
  })

  afterEach(() => {
    process.exit = originalExit
    process.argv = originalArgv
  })

  it('should handle successful MDX generation', async () => {
    // Configure mock for successful generation
    vi.mocked(generateMDX).mockResolvedValueOnce({
      content: 'Generated MDX content',
      progressMessage: 'Content generation completed',
      progress: 100,
    })

    // Test file operations
    const stdoutSpy = vi.spyOn(process.stdout, 'write')
    const stderrSpy = vi.spyOn(process.stderr, 'write')

    // Run CLI with valid prompt and type
    process.argv = ['node', 'cli', 'Generate a test article', '--type', 'Article']
    await cli()

    expect(stdoutSpy).toHaveBeenCalled()
    expect(stderrSpy).toHaveBeenCalled()
    expect(process.exit).not.toHaveBeenCalled()

    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('should handle missing arguments correctly', async () => {
    process.argv = ['node', 'cli']
    await cli()

    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should handle generation errors', async () => {
    // Configure mock for failed generation
    vi.mocked(generateMDX).mockRejectedValueOnce(new GenerationError('Generation failed'))

    process.argv = ['node', 'cli', 'Generate content', '--type', 'Article']
    await cli()
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
