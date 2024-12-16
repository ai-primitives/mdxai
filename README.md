# mdxai

[![npm version](https://badge.fury.io/js/mdxai.svg)](https://www.npmjs.com/package/mdxai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config CLI to recursively generate and update MDX structured data, unstructured content, import/export Javascript/Typescript, and JSX/Reach UI components using MDXLD (Linked Data).

## Features

- 🚀 Zero-config MDX generation and updates
- 📝 Support for schema.org, gs1.org, and mdx.org.ai contexts
- 🔄 Recursive directory processing with concurrent execution
- 📊 Real-time progress streaming to terminal
- 🌐 Browser and edge runtime compatible
- ⚡️ CLI powered by fs/promises for Node.js environments
- 💻 Import/export JavaScript/TypeScript
- 🎨 JSX/React UI component support

## Installation

Install globally:
```bash
npm install -g mdxai
```

Or use with npx:
```bash
npx mdxai generate ./content --type="https://schema.org/Article"
```

## CLI Usage

Generate MDX content with real-time progress streaming:

```bash
# Generate MDX from a directory
mdxai generate ./content --type="https://schema.org/Article"

# Process multiple files recursively
mdxai generate ./blog/**/*.mdx --type="https://schema.org/BlogPosting"

# Set concurrency limit (default: 2)
mdxai generate ./docs --type="https://mdx.org.ai/TypeScript" --concurrency=4
```

The CLI provides real-time feedback:
- Streams AI-generated content to terminal as it's being generated
- Shows file processing progress
- Indicates concurrent file operations
- Writes generated content to .generated.mdx files

### CLI Options

```bash
mdxai generate <paths...> --type <schema> [options]

Options:
  --type <schema>     Schema type (e.g., https://schema.org/Article)
  --concurrency <n>   Number of concurrent generations (default: 2)
  -v, --version      Show version number
  -h, --help         Show help
```

## SDK Usage

For programmatic usage in browser or edge environments:

```typescript
import { generateMDX } from 'mdxai'

// Stream MDX generation
const stream = await generateMDX({
  type: 'https://schema.org/Article',
  content: '# My Article',
  components: ['Button', 'Card'], // Optional JSX components
})

// Handle streaming output
stream.on('data', chunk => {
  console.log(chunk) // Process chunks as they arrive
})

await new Promise((resolve, reject) => {
  stream.on('end', resolve)
  stream.on('error', reject)
})
```

### YAML-LD Frontmatter

MDX files can include YAML-LD frontmatter:

```yaml
# Using $ prefix for YAML-LD properties
$type: https://schema.org/Article
$context: https://schema.org
title: My Article
description: An example article
```

## Dependencies

This package uses:
- mdxld for MDX Linked Data processing
- ai-functions for AI-powered content generation
- fs/promises (Node.js only) for CLI operations

## Runtime Compatibility

- CLI features use fs/promises and are Node.js only
- Main package exports are compatible with browser and edge runtimes
- Component generation works in all environments
