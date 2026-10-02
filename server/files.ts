import { createHash } from 'node:crypto'
import { gprotabFiles } from './sources/gprotab.ts'
import { gtptabsFiles } from './sources/gtptabs.ts'
import { guitarprotabsFiles } from './sources/guitarprotabs.ts'
import { theguitarlessonFiles } from './sources/theguitarlesson.ts'
import { ultimateGuitarFiles } from './sources/ultimateGuitar.ts'
import type { DownloadedFile, FileSource, TabSource } from './types.ts'

const CACHE_TTL_MS = 10 * 60_000
const CACHE_LIMIT = 100

/** The sources whose files this server can fetch. */
export const FILE_SOURCES: Partial<Record<TabSource, FileSource>> = {
  gprotab: gprotabFiles,
  gtptabs: gtptabsFiles,
  guitarprotabs: guitarprotabsFiles,
  theguitarlesson: theguitarlessonFiles,
  'ultimate-guitar': ultimateGuitarFiles,
}

export class NotDownloadableError extends Error {
  constructor(source: string, path: string) {
    super(`${source} has no file at ${path}.`)
    this.name = 'NotDownloadableError'
  }
}

export const fingerprintOf = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex')

export type FetchFile = (source: TabSource, path: string) => Promise<DownloadedFile>

/**
 * Fetches tab files and remembers them for a while: the search fetches the
 * best results to tell copies apart, and adding one of them then costs the
 * site nothing more.
 */
export const createFetchFile = (
  fetchImpl: typeof fetch = fetch,
  sources: Partial<Record<TabSource, FileSource>> = FILE_SOURCES,
): FetchFile => {
  const cache = new Map<string, { expiresAt: number; file: Promise<DownloadedFile> }>()

  return (source, path) => {
    const fileSource = Object.hasOwn(sources, source) ? sources[source] : undefined
    if (!fileSource || !fileSource.pathPattern.test(path)) {
      return Promise.reject(new NotDownloadableError(source, path))
    }

    const key = `${source}:${path}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.file
    }

    const file = fileSource.fetchFile(path, fetchImpl)
    // A failure is not worth remembering; the next try should ask again.
    file.catch(() => cache.delete(key))

    if (cache.size >= CACHE_LIMIT) {
      cache.delete(cache.keys().next().value!)
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, file })

    return file
  }
}
