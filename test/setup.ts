import { beforeAll } from 'vitest'
import { setMaxListeners } from 'events'

// Increase max listeners to prevent warnings during parallel test execution
beforeAll(() => {
  setMaxListeners(20) // Match our max concurrent threads
  process.setMaxListeners(20)
})
