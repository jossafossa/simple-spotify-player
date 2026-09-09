import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

/** Minimal in-memory Storage, for the parts of jsdom that don't supply one. */
const createStorage = (): Storage => {
  let entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => {
      entries = new Map()
    },
  } as Storage
}

// This jsdom build exposes sessionStorage but not localStorage, and implements
// no scrollIntoView at all, so both are stubbed rather than worked around in
// the components and libraries under test.
if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', { value: createStorage(), configurable: true })
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

afterEach(() => {
  cleanup()
})
