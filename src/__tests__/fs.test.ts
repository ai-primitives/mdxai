import { describe, it, expect, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { getDirname, readFile, writeFile, exists, resolvePath } from '../utils/fs.js'

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}))

describe('Filesystem Utilities', () => {
  it('should resolve dirname correctly', () => {
    const result = getDirname(import.meta.url)
    expect(result).toContain('__tests__')
  })

  it('should read files safely', async () => {
    const mockContent = 'test content'
    vi.mocked(fs.readFile).mockResolvedValue(mockContent)

    const content = await readFile('test.txt')
    expect(content).toBe(mockContent)
    expect(fs.readFile).toHaveBeenCalledWith('test.txt', 'utf-8')
  })

  it('should write files safely', async () => {
    const content = 'test content'
    await writeFile('test.txt', content)

    expect(fs.mkdir).toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith('test.txt', content, 'utf-8')
  })

  it('should check file existence', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined)
    expect(await exists('exists.txt')).toBe(true)

    vi.mocked(fs.access).mockRejectedValue(new Error())
    expect(await exists('not-exists.txt')).toBe(false)
  })

  it('should resolve paths correctly', () => {
    const base = '/base/path'
    const result = resolvePath(base, 'sub', 'file.txt')
    expect(result).toContain('/base/path/sub/file.txt')
  })
})
