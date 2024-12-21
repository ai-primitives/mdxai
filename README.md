# mdxai

[![npm version](https://badge.fury.io/js/mdxai.svg)](https://www.npmjs.com/package/mdxai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config CLI to recursively generate and update MDX structured data, unstructured content, import/export Javascript/TypeScript, and JSX/Reach UI components using MDXLD (Linked Data).

## Features

- 🚀 Zero-config MDX generation and updates
- 📝 Support for schema.org, gs1.org, and mdx.org.ai contexts
- 🔄 Recursive directory processing with concurrent execution (In Progress)
- 📊 Real-time progress streaming to terminal (In Progress)
- 🌐 Browser and edge runtime compatible (In Progress)
- ⚡️ CLI powered by fs/promises for Node.js environments (In Progress)
- 💻 Import/export JavaScript/TypeScript (In Progress)
- 🎨 JSX/React UI component support (In Progress)

## Installation

Install globally:

```bash
npm install -g mdxai
```

Or use with npx:

```bash
npx mdxai generate ./content --type="https://schema.org/Article"
```

Note: This package depends on mdxld@0.1.3. While previous versions had issues with the parser module affecting test execution, the current version has resolved many of these issues. Please refer to the Known Issues section for any remaining concerns.

## CLI Usage

Generate MDX content with real-time progress streaming:

```bash
# Generate MDX from a directory using schema.org
mdxai generate ./content --type="https://schema.org/Article"

# Process multiple files with gs1.org context
mdxai generate ./products/**/*.mdx --type="https://gs1.org/voc/Product"

# Generate TypeScript documentation with mdx.org.ai
mdxai generate ./docs --type="https://mdx.org.ai/TypeScript" --concurrency=4

# Process blog posts with real-time streaming
mdxai generate ./blog --type="https://schema.org/BlogPosting" --stream
```

The CLI provides real-time feedback and zero-config operation:

- Zero configuration needed - just specify the type and start generating
- Automatically detects and processes MDX files recursively
- Infers appropriate layouts and components based on schema type
- Handles YAML-LD frontmatter conversion automatically
- Streams AI-generated content to terminal as it's being generated
- Shows file processing progress with concurrent operations
- Creates .generated.mdx files alongside originals

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
stream.on('data', (chunk) => {
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

## Known Issues

- CI/CD Pipeline
  - Issue: Missing GitHub Actions workflows for automated testing
  - Impact: Manual verification required for contributions
  - Status: CI configuration is planned for implementation
  - Note: Local testing can be performed using `pnpm test`

For the latest updates and issue tracking, please visit our GitHub repository.
