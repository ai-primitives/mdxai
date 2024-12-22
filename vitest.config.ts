import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 second timeout per test for faster failures
    hookTimeout: 180000,
    teardownTimeout: 15000,
    setupFiles: ['dotenv/config'],
    fileParallelism: true,
    maxConcurrency: 20,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 20
      }
    },
    retry: 2, // Retry failed tests up to 2 times
    sequence: {
      shuffle: true // Randomize test order to catch ordering issues
    }
  }
})
