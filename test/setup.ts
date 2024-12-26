import { beforeAll } from 'vitest'
import { setMaxListeners } from 'events'

// // Increase max listeners to prevent warnings during parallel test execution
// beforeAll(() => {
//   setMaxListeners(30) // Set higher than maxThreads to account for test setup
//   process.setMaxListeners(30)
//   // Also set for unhandledRejection listeners
//   process.getMaxListeners() < 30 && process.setMaxListeners(30)
// })
