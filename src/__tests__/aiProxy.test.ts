/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { join } from 'node:path'
import { writeFile, exists, resolvePath } from '../utils/fs.js'
import * as fs from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { ai } from '../aiProxy.js'
import { generateObject, type GenerateObjectResult, type JSONValue, type LanguageModel } from 'ai'

// Mock the generateObject function
vi.mock('ai', () => ({
  generateObject: vi.fn().mockImplementation(async (options: {
    mode?: 'auto' | 'json' | 'tool'
    output?: 'array' | 'object' | 'no-schema'
    prompt: string
    model: LanguageModel
    schema?: unknown
  }) => {
    // Set default output to 'object' if not specified
    const output = options.output || 'object'
    const baseResult = {
      finishReason: 'stop' as const,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: options.prompt },
      response: { 
        id: 'test',
        modelId: 'test-model',
        timestamp: new Date(),
        headers: { 'content-type': 'application/json' }
      },
      logprobs: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new globalThis.Response(JSON.stringify({ test: 'test' }))
    }

    if (output === 'array') {
      return { ...baseResult, object: ['item1', 'item2'] as JSONValue }
    } else if (output === 'no-schema') {
      return { ...baseResult, object: 'test content' as JSONValue }
    } else {
      return { ...baseResult, object: { content: 'test content' } as JSONValue }
    }
  })
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
    await mkdir(aiDir, { recursive: true })
    await writeFile(testFile, defaultFrontmatter + '\n')
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up test files
    vi.clearAllMocks()
    try {
      await fs.unlink(testFile)
    } catch (error) {
      // Ignore file not found errors
      const fsError = error as { code?: string }
      if (fsError.code !== 'ENOENT') {
        throw error
      }
    }
  })

  it('should create MDX file if it does not exist', async () => {
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
      toJsonResponse: () => new globalThis.Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    await writeFile(testFile, defaultFrontmatter + '\n')
    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(await exists(testFile)).toBe(true)
    expect(result).toMatchObject({ content: 'test content' })
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
---

`
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
      toJsonResponse: () => new globalThis.Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'json',
        prompt: expect.any(String),
        output: 'object',
        schema: expect.any(Object)
      })
    )
    expect(result).toMatchObject({ content: 'test content' })
  })

  it('should handle array schema type', async () => {
    const testFrontmatter = `---
model: gpt-4o
system: Test system prompt
schema:
  type: array
  items:
    type: string
---

`
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
      toJsonResponse: () => new globalThis.Response(JSON.stringify({ test: 'test' }))
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
---

`
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
      toJsonResponse: () => new globalThis.Response(JSON.stringify({ test: 'test' }))
    }
    ;((generateObject as unknown) as Mock<typeof generateObject>).mockResolvedValue(mockResult)

    const result = await (ai as Record<string, (args?: Record<string, unknown>) => Promise<unknown>>).testFunction({ param: 'test' })
    
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'json',
        output: 'no-schema'
      })
    )
    expect(result).toMatchObject({ content: 'test content' })
  })
})
