import { describe, it, expect, vi } from 'vitest'
import { parseArgs, showHelp, showVersion, cli } from './index'

describe('CLI', () => {
  it('should parse version flag correctly', () => {
    const options = parseArgs(['-v'])
    expect(options.version).toBe(true)

    const longOptions = parseArgs(['--version'])
    expect(longOptions.version).toBe(true)
  })

  it('should parse help flag correctly', () => {
    const options = parseArgs(['-h'])
    expect(options.help).toBe(true)

    const longOptions = parseArgs(['--help'])
    expect(longOptions.help).toBe(true)
  })

  it('should show version number', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    showVersion()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should show help message', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    showHelp()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should default to help when no arguments provided', () => {
    const consoleSpy = vi.spyOn(console, 'log')
    cli([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should parse type option correctly', () => {
    const options = parseArgs(['--type', 'https://schema.org/Article'])
    expect(options.type).toBe('https://schema.org/Article')
  })

  it('should parse concurrency option correctly', () => {
    const options = parseArgs(['--concurrency', '4'])
    expect(options.concurrency).toBe(4)
  })

  it('should parse generate command with input paths', () => {
    const options = parseArgs(['generate', './content', './docs'])
    expect(options.input).toEqual(['./content', './docs'])
  })

  it('should parse multiple options together', () => {
    const options = parseArgs([
      'generate',
      './content',
      '--type',
      'https://schema.org/Article',
      '--concurrency',
      '4'
    ])
    expect(options).toEqual({
      input: ['./content'],
      type: 'https://schema.org/Article',
      concurrency: 4
    })
  })

  it('should show help when no type is provided with generate', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    await cli(['generate', './content'])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
