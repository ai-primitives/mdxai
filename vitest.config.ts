import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000, // 10 second timeout per test
    hookTimeout: 10000, // Consistent 10s timeout
    teardownTimeout: 10000, // Consistent 10s timeout
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
