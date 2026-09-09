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

// Node's own experimental localStorage shadows jsdom's and resolves to
// undefined without --localstorage-file, and jsdom implements no
// scrollIntoView at all. Both are installed unconditionally: feature-detecting
// them would mean the suite exercised a different Storage depending on the
// Node version it happened to run under.
Object.defineProperty(window, 'localStorage', {
  value: createStorage(),
  configurable: true,
})

Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
})
