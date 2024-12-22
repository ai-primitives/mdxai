import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000, // 10 second timeout for all tests
    hookTimeout: 10000,
    teardownTimeout: 10000,
    maxConcurrency: 20, // Run up to 20 tests in parallel
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 20, // Maximum thread count
        isolate: true // Ensure test isolation
      }
    },
    setupFiles: ['dotenv/config'],
    fileParallelism: true, // Enable parallel file execution
    retry: 2, // Retry failed tests
    sequence: {
      shuffle: true // Randomize test order
    }
  }
})
