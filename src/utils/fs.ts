/**
 * Runtime-safe filesystem utilities
 * Only used by CLI, not exported in main package
 */

import { promises as fs } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Helper to get current file directory
export function getDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl))
}

// Safe file operations
export async function readFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8')
}

export async function writeFile(path: string, content: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, content, 'utf-8')
}

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

// Safe path resolution
export function resolvePath(base: string, ...paths: string[]): string {
  return resolve(base, ...paths)
}
