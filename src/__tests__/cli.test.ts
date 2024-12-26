import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFile } from '../utils/fs.js'
import { cli } from '../cli/index.js'

vi.mock('../utils/fs.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  resolvePath: vi.fn(),
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

  it('should handle file input/output operations', async () => {
    const mockContent = 'test content'
    vi.mocked(readFile).mockResolvedValue(mockContent)

    // Test file operations
    const stdoutSpy = vi.spyOn(process.stdout, 'write')
    const stderrSpy = vi.spyOn(process.stderr, 'write')

    // Run CLI with mock input
    process.argv = ['node', 'cli', 'test prompt']
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
})
