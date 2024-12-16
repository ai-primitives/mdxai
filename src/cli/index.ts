import { version } from '../../package.json'
import PQueue from 'p-queue'
import { createWriteStream } from 'node:fs'
import { writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generateMDX } from '../index.js'
import { glob } from 'glob'

interface CliOptions {
  type?: string
  input?: string[]
  concurrency?: number
  help?: boolean
  version?: boolean
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '-v':
      case '--version':
        options.version = true
        break
      case '-h':
      case '--help':
        options.help = true
        break
      case '--type':
        if (nextArg) {
          options.type = nextArg
          i++ // Skip next arg
        }
        break
      case '--concurrency':
        if (nextArg) {
          options.concurrency = parseInt(nextArg, 10)
          i++ // Skip next arg
        }
        break
      case 'generate':
        options.input = []
        while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options.input.push(args[++i])
        }
        break
    }
  }

  return options
}

export function showHelp(): void {
  console.log(`
mdxai - Zero-config CLI to generate and update MDX with AI

Usage: mdxai generate <paths...> --type <schema> [options]

Commands:
  generate <paths...>  Generate MDX for specified files/directories

Options:
  --type <schema>     Schema type (e.g., https://schema.org/Article)
  --concurrency <n>   Number of concurrent generations (default: 2)
  -v, --version      Show version number
  -h, --help         Show help

Examples:
  mdxai generate ./content --type="https://schema.org/Article"
  mdxai generate ./blog/**/*.mdx --type="https://schema.org/BlogPosting"
  mdxai generate ./docs --type="https://mdx.org.ai/TypeScript" --concurrency=4
`)
}

export function showVersion(): void {
  console.log(`v${version}`)
}

async function processFile(filepath: string, type: string): Promise<void> {
  try {
    await access(filepath)
    const outputPath = filepath.replace(/\.(md|mdx)?$/, '.generated.mdx')
    await writeFile(outputPath, '')
    const stream = await generateMDX({ type, filepath })
    const fileStream = createWriteStream(outputPath)

    stream.on('data', (chunk) => {
      process.stdout.write(chunk)
      fileStream.write(chunk)
    })

    await new Promise((resolve, reject) => {
      stream.on('end', resolve)
      stream.on('error', reject)
    })

    fileStream.end()
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error)
    throw error
  }
}

export async function cli(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args)

  if (options.version) {
    showVersion()
  } else if (options.help) {
    showHelp()
  } else if (options.input && options.type) {
    const queue = new PQueue({ concurrency: options.concurrency || 2 })

    for (const pattern of options.input) {
      const files = await glob(pattern)
      for (const filepath of files) {
        const fullPath = resolve(process.cwd(), filepath)
        queue.add(() => processFile(fullPath, options.type!))
      }
    }

    try {
      await queue.onIdle()
      console.log('\nAll files processed successfully!')
    } catch (error) {
      console.error('\nError during processing:', error)
      process.exit(1)
    }
  } else {
    showHelp()
  }
}
