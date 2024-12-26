import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from '../utils/fs.js'
import { cli } from '../cli/index.js'

vi.mock('../utils/fs.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  resolvePath: vi.fn(),
}))

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(stdoutSpy).toHaveBeenCalled()

    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })
})
