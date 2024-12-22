import { describe, it, expect, vi } from 'vitest'
import { generateMDX } from './index.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('generateMDX', () => {
  vi.setConfig({ testTimeout: 30000 })

  it('should stream and return MDX content', async () => {
    const { text, stream, finishReason, usage } = await generateMDX({
      type: 'https://schema.org/Article',
      topic: 'AI Testing',
      components: ['Button']
    })

    // Verify stream works
    let streamedContent = ''
    for await (const chunk of stream) {
      streamedContent += chunk
    }

    // Verify response structure
    expect(text).toBeTruthy()
    expect(text.replace(/\s+/g, ' ').trim()).toBe(streamedContent.replace(/\s+/g, ' ').trim())
    expect(finishReason).toBe('stop')
    expect(usage).toHaveProperty('totalTokens')
    
    // Verify content structure
    expect(text).toMatch(/^---/) // Should have frontmatter
    expect(text).toMatch(/\$type: https:\/\/schema\.org\/Article/) // Should have schema type
    expect(text).toMatch(/---\s*\n/) // Should end frontmatter
    expect(text).toMatch(/^#\s+\w+/m) // Should have a heading
  })

  it('should stream to file and stdout', async () => {
    const testFilePath = path.join(__dirname, 'test-output.mdx')
    
    // Clean up any existing test file
    try {
      await fs.unlink(testFilePath)
    } catch (e) {
      // File might not exist, that's ok
    }

    const { text, stream } = await generateMDX({
      type: 'https://schema.org/Article',
      topic: 'File Streaming Test',
      filepath: testFilePath,
      components: ['Card']
    })

    // Verify file was written and matches the returned content
    const fileContent = await fs.readFile(testFilePath, 'utf-8')
    expect(fileContent).toBe(text)
    
    // Verify content includes components
    expect(text).toMatch(/<Card/)

    // Clean up
    await fs.unlink(testFilePath)
  })

  it('should handle multiple components', async () => {
    const { text } = await generateMDX({
      type: 'https://schema.org/Article',
      topic: 'Component Integration',
      components: ['Button', 'Card', 'Alert']
    })

    // Verify at least one component was used
    const componentUsed = ['Button', 'Card', 'Alert'].some(
      component => text.includes(`<${component}`)
    )
    expect(componentUsed).toBe(true)
  })

  it('should generate multiple versions when count > 1', async () => {
    const { text } = await generateMDX({
      type: 'https://schema.org/Article',
      topic: 'Multiple Versions',
      count: 2
    })

    // Should have multiple article sections
    const articleCount = (text.match(/^#\s+/gm) || []).length
    expect(articleCount).toBeGreaterThanOrEqual(2)
  })

  it('should handle file writing errors', async () => {
    const invalidPath = path.join(__dirname, 'nonexistent', 'invalid', 'test.mdx')
    
    // Mock fs.writeFile to simulate a write error
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Failed to write file'))

    try {
      await generateMDX({
        type: 'https://schema.org/Article',
        topic: 'Error Handling',
        filepath: invalidPath
      })
      // If we get here, the test should fail
      expect('should have thrown').toBe(false)
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toBe('Failed to write file')
      } else {
        throw error
      }
    }

    // Restore the original implementation
    vi.restoreAllMocks()
  })

  it('should incorporate input content', async () => {
    const inputContent = '# Existing Content\nThis is some existing content.'
    const { text } = await generateMDX({
      type: 'https://schema.org/Article',
      content: inputContent
    })

    // Should reference or incorporate the input content
    expect(text).toMatch(/Existing Content/i)
  })
})
