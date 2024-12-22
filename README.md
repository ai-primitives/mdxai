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
# Generate MDX from a directory using schema.org
mdxai <filepath> <instructions to generate or edit content>
```

```bash
# Generate MDX from a directory using schema.org
mdxai blog/future-of-ai.mdx  write a blog post about the future of AI

# Edit MDX content
mdxai blog/future-of-ai.mdx  add more real-world examples from recent news

# Work with multiple files
mdxai content/**/* change the voice of the content to be more conversational
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
$type: https://schema.org/Article
title: My Article
description: An example article
---

# My Article

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