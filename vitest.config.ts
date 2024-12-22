import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 second timeout for AI-dependent tests
    hookTimeout: 10000, // Keep hook timeout at 10s
    teardownTimeout: 10000, // Keep teardown timeout at 10s
    maxConcurrency: 20, // Maximum concurrent tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 20, // Use all available threads
        isolate: true // Ensure proper test isolation
      }
    },
    setupFiles: ['dotenv/config'],
    fileParallelism: true,
    retry: 2, // Retry failed tests up to 2 times
    sequence: {
      shuffle: true // Randomize test order to catch ordering issues
    }
  }
})
