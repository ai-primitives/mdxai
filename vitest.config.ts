import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 second timeout for all tests
    hookTimeout: 30000, // Consistent timeout
    teardownTimeout: 30000, // Consistent timeout
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
