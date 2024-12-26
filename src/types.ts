import type { Root, RootContent } from 'mdast'

/**
 * Extended interface for AST data with YAML-LD properties
 */
export interface MDXLDData {
  /** Schema.org type with $ prefix */
  $type: string
  /** Schema.org type with @ prefix */
  '@type': string
  /** Schema.org context with $ prefix */
  $context: string
  /** Schema.org context with @ prefix */
  '@context': string
  /** Metadata containing keywords and properties */
  metadata: {
    keywords: string[]
    category: string
    properties: {
      version: string
      generator: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Extended MDXLD interface with AST support and children
 */
export interface MDXLDWithAST extends Root {
  /** AST data including YAML-LD properties */
  data: MDXLDData
  /** AST children nodes */
  children: RootContent[]
}

/**
 * Options for parsing MDX documents
 */
export interface ParseOptions {
  /** Whether to parse the content as AST */
  ast?: boolean
  /** Whether to allow @ prefix (defaults to $ prefix) */
  allowAtPrefix?: boolean
}

/**
 * Options for stringifying MDX documents
 */
export interface StringifyOptions {
  /** Whether to use @ prefix instead of default $ */
  useAtPrefix?: boolean
}

/**
 * Special properties that should be extracted to root level
 */
export type SpecialProperty = 'type' | 'context' | 'id' | 'language' | 'base' | 'vocab' | 'list' | 'set' | 'reverse'

/**
 * Re-export MDXLDAST type for backward compatibility
 */
export type MDXLDAST = MDXLDWithAST
