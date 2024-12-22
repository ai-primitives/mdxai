import { describe, it, expect, vi } from 'vitest'
import { generateMDX } from './index'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('generateMDX', () => {
  vi.setConfig({ testTimeout: 30000 })

  it(
    'should generate MDX content with basic options',
    async () => {
      const result = await generateMDX({
        type: 'article',
        topic: 'React Hooks',
      })

      expect(result).toContain('# ') // Should contain headings
      expect(result).toContain('```') // Should contain code blocks
    },
    { timeout: 30000 },
  )

  it(
    'should generate MDX and write to file',
    async () => {
      const testFilePath = path.join(__dirname, 'test.mdx')

      const result = await generateMDX({
        type: 'tutorial',
        topic: 'TypeScript Basics',
        filepath: testFilePath,
      })

      // Verify file was written
      const fileContent = await fs.readFile(testFilePath, 'utf-8')
      expect(fileContent).toBe(result)

      // Cleanup
      await fs.unlink(testFilePath)
    },
    { timeout: 30000 },
  )

  it(
    'should incorporate specified components',
    async () => {
      const result = await generateMDX({
        type: 'documentation',
        topic: 'API Reference',
        components: ['CodeBlock', 'Alert', 'Table'],
      })

      // Check if components are used in the generated MDX
      expect(result).toMatch(/<(CodeBlock|Alert|Table)/)
    },
    { timeout: 30000 },
  )

  it(
    'should handle errors gracefully',
    async () => {
      await expect(
        generateMDX({
          type: 'invalid-type',
          topic: '',
        }),
      ).rejects.toThrow()
    },
    { timeout: 30000 },
  )
})
