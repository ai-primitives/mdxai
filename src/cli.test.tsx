import React from 'react'
import { render } from 'ink-testing-library'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { App } from './cli.js'
import { streamText } from 'ai'
import path from 'path'
import type * as ReactTypes from 'react'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import { defaultModel } from './utils/openai.js'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Test configuration
const TEST_TIMEOUT = 15000 // 15 second timeout for test execution
const MAX_TOKENS = 100 // Token limit for faster test execution
const MODEL: LanguageModelV1 = defaultModel // Use gpt-4o-mini model configuration
