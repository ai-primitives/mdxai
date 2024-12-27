import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { join } from 'node:path'
import { writeFile, exists, resolvePath } from '../utils/fs.js'
import { ai } from '../aiProxy.js'
import { generateObject, type GenerateObjectResult, type JSONValue } from 'ai'
import { z } from 'zod'

// Mock the generateObject function
vi.mock('ai', () => ({
  generateObject: vi.fn()
}))

describe('AI Proxy', () => {
  const aiDir = resolvePath(process.cwd(), 'ai')
  const testFile = join(aiDir, 'testFunction.mdx')
  const defaultFrontmatter = `---
model: gpt-4o
system: Test system prompt
schema:
  type: object
  properties:
    content:
      type: string
  required: [content]
---`

  beforeEach(async () => {
    vi.clearAllMocks()
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockImplementation(async (options) => {
      const baseResult = {
        finishReason: 'stop' as const,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        warnings: [],
        request: { body: '{"test":"test"}' },
        response: { 
          id: 'test',
          modelId: 'test-model',
          timestamp: new Date(),
          headers: { 'content-type': 'application/json' }
        },
        logprobs: undefined,
        experimental_providerMetadata: undefined,
        toJsonResponse: () => new Response(JSON.stringify({ test: 'test' }))
      }
      if (options.output === 'no-schema') {
        return { ...baseResult, object: 'test content' as JSONValue }
      } else if (options.output === 'array') {
        return { ...baseResult, object: ['item1', 'item2'] as JSONValue }
      } else {
        return { ...baseResult, object: { content: 'test content' } as JSONValue }
      }
    })
  })

  afterEach(async () => {
    // Clean up test files
    vi.clearAllMocks()
  })

  it('should create MDX file if it does not exist', async () => {
    const mockResult: GenerateObjectResult<JSONValue> = {
      object: 'test content' as JSONValue,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: '{"test":"test"}' },
      response: { 
        id: 'test',
        modelId: 'test-model',
        timestamp: new Date(),
        headers: { 'content-type': 'application/json' }
      },
      logprobs: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    await writeFile(testFile, defaultFrontmatter)
    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(await exists(testFile)).toBe(true)
    expect(result).toEqual({ content: 'test content' })
  })

  it('should use existing MDX file configuration', async () => {
    const testFrontmatter = `---
model: gpt-4o
system: Test system prompt
schema:
  type: object
  properties:
    content:
      type: string
  required: [content]
---`
    await writeFile(testFile, testFrontmatter)

    const mockResult: GenerateObjectResult<JSONValue> = {
      object: { content: 'test content' } as JSONValue,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: '{"test":"test"}' },
      response: { 
        id: 'test',
        modelId: 'test-model',
        timestamp: new Date(),
        headers: { 'content-type': 'application/json' }
      },
      logprobs: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Test system prompt',
        mode: 'json',
        output: 'object'
      })
    )
    expect(result).toEqual({ content: 'test content' })
  })

  it('should handle array schema type', async () => {
    const testFrontmatter = `---
model: gpt-4o
system: Test system prompt
schema:
  type: array
  items:
    type: string
---`
    await writeFile(testFile, testFrontmatter)

    const mockResult: GenerateObjectResult<JSONValue> = {
      object: ['item1', 'item2'] as JSONValue,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: '{"test":"test"}' },
      response: { 
        id: 'test',
        modelId: 'test-model',
        timestamp: new Date(),
        headers: { 'content-type': 'application/json' }
      },
      logprobs: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'json',
        output: 'array'
      })
    )
    expect(result).toEqual({ items: ['item1', 'item2'] })
  })

  it('should handle no schema case', async () => {
    const testFrontmatter = `---
model: gpt-4o
system: Test system prompt
---`
    await writeFile(testFile, testFrontmatter)

    const mockResult: GenerateObjectResult<JSONValue> = {
      object: 'test content' as JSONValue,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: '{"test":"test"}' },
      response: { 
        id: 'test',
        modelId: 'test-model',
        timestamp: new Date(),
        headers: { 'content-type': 'application/json' }
      },
      logprobs: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'json',
        output: 'no-schema'
      })
    )
    expect(result).toEqual({ content: 'test content' })
  })
})
