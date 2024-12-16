# @ai-primitives/mdxai

[![npm version](https://badge.fury.io/js/%40ai-primitives%2Fmdxai.svg)](https://www.npmjs.com/package/@ai-primitives/mdxai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config CLI to recursively generate and update MDX structured data, unstructured content, import/export Javascript/Typescript, and JSX/Reach UI components using MDXLD (Linked Data).

## Features

- 🚀 Zero-config MDX generation and updates
- 📝 Support for schema.org, gs1.org, and mdx.org.ai contexts
- 🔄 Recursive directory processing
- 🌐 Browser and edge runtime compatible
- ⚡️ CLI powered by fs/promises for Node.js environments
- 💻 Import/export JavaScript/TypeScript
- 🎨 JSX/React UI component support

## Installation

```bash
pnpm add @ai-primitives/mdxai
```

## Usage

### CLI Usage

```bash
# Generate MDX from a directory
mdxai generate ./content --type="https://schema.org/Article"

# Process multiple files recursively
mdxai generate ./blog/**/*.mdx --type="https://schema.org/BlogPosting"

# Import JavaScript/TypeScript
mdxai generate ./docs --type="https://mdx.org.ai/TypeScript"
```

### YAML-LD Frontmatter

```yaml
# Using $ prefix for YAML-LD properties
$type: https://schema.org/Article
$context: https://schema.org
title: My Article
description: An example article
```

### Browser/Edge Usage

```typescript
import { generateMDX } from '@ai-primitives/mdxai'

const mdx = await generateMDX({
  type: 'https://schema.org/Article',
  content: '# My Article',
  components: ['Button', 'Card'], // Optional JSX components
})
```

## Dependencies

This package uses:

- @ai-primitives/mdxld for MDX Linked Data processing
- @ai-primitives/ai-functions for AI-powered content generation
- fs/promises (Node.js only) for CLI operations

## Runtime Compatibility

- CLI features use fs/promises and are Node.js only
- Main package exports are compatible with browser and edge runtimes
- Component generation works in all environments
