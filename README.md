# mdxai

[![npm version](https://badge.fury.io/js/mdxai.svg)](https://www.npmjs.com/package/mdxai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config CLI to recursively generate and update MDX with frontmatter, structured data, and executable code, and JSX/React components.

## Features

- 🚀 Zero-config MDX generation and updates
- 📝 Support for schema.org and mdx.org.ai contexts & types
- 🔄 Recursive directory processing with concurrent execution
- 📊 Real-time progress streaming to terminal
- 🌐 Browser and edge runtime compatible
- ⚡️ CLI powered by fs/promises for Node.js environments

## Installation

Install globally:

```bash
npm install -g mdxai
```

Or use with npx:

```bash
npx mdxai hello-world write a blog post about the future of AI
```

## CLI Usage

Generate MDX content with real-time progress streaming:

```bash
# Basic usage
mdxai [options] <filepath> <prompt>
```

Options:
- `--type` - Schema type (default: https://schema.org/Article)
- `--concurrency` - Number of concurrent operations (default: 4)
- `--max-tokens` - Maximum tokens for generation (default: 100)
- `--model` - Model to use (default: gpt-4o-mini)
- `--components` - Comma-separated list of components to include

Examples:

```bash
# Generate a new blog post
mdxai blog/future-of-ai.mdx write a blog post about the future of AI

# Edit existing content with increased token limit
mdxai --max-tokens 2000 blog/future-of-ai.mdx add more real-world examples from recent news

# Process multiple files with custom concurrency
mdxai --concurrency 4 content/**/* change the voice of the content to be more conversational

# Edit MDX content (.mdx extension is optional)
mdxai blog/future-of-ai  add more real-world examples from recent news

# Use multiple options together
mdxai --type="https://schema.org/BlogPosting" --max-tokens 200 --model="gpt-4" blog/post.mdx write a detailed technical post
```

The CLI provides real-time feedback and zero-config operation:

- Zero configuration needed - just specify the type and start generating
- Automatically detects and processes MDX files recursively
- Infers appropriate layouts and components based on schema type
- Handles YAML-LD frontmatter conversion automatically
- Streams AI-generated content to terminal as it's being generated
- Shows file processing progress with concurrent operations
- Creates .generated.mdx files alongside originals

### YAML-LD Frontmatter

MDX files can include MDX-LD/YAML-LD frontmatter:

```yaml
---
# Using $ prefix for MDX-LD properties
$id: https://example.com/my-example-article
$type: https://schema.org/Article
title: My Example Article
description: An example article
---
# My Example Article

This is an example article.
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
