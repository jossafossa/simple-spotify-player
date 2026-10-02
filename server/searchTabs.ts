import { fingerprintOf, type FetchFile } from './files.ts'
import { searchGprotab } from './sources/gprotab.ts'
import { searchGtptabs } from './sources/gtptabs.ts'
import { searchGuitarprotabs } from './sources/guitarprotabs.ts'
import { searchTheguitarlesson } from './sources/theguitarlesson.ts'
import { searchSongsterr } from './sources/songsterr.ts'
import { searchUltimateGuitar } from './sources/ultimateGuitar.ts'
import type { FetchPage, OnlineTab, SearchQuery, SourceSearch, TabSource } from './types.ts'

export type SearchResponse = {
  results: OnlineTab[]
  /** Sources that failed; the others still answer. */
  failures: { source: TabSource; message: string }[]
}

const SOURCES: Record<TabSource, SourceSearch> = {
  gprotab: searchGprotab,
  gtptabs: searchGtptabs,
  guitarprotabs: searchGuitarprotabs,
  theguitarlesson: searchTheguitarlesson,
  songsterr: searchSongsterr,
  'ultimate-guitar': searchUltimateGuitar,
}

/** Files to choose from; links to other sites are listed besides these. */
const MAX_DOWNLOADABLE = 40
/** Files fetched at once while comparing, so no tab site gets a burst. */
const COMPARE_CONCURRENCY = 6
/**
 * How long comparing may hold up the answer. Files not in by then are listed
 * unchecked; those already asked for are still cached when they land.
 */
const COMPARE_TIMEOUT_MS = 5_000

/**
 * Best match first; between equally good matches, a file that can be
 * downloaded beats a link, and a well-voted tab beats an unrated one.
 */
const rank = (a: OnlineTab, b: OnlineTab): number =>
  b.relevance - a.relevance ||
  Number(!!b.downloadPath) - Number(!!a.downloadPath) ||
  (b.votes ?? 0) - (a.votes ?? 0)

/** Runs the task for every item, at most `limit` at a time, in order. */
const mapWithLimit = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const dataWithin = (file: Promise<{ data: Uint8Array }>, timeoutMs: number): Promise<Uint8Array | undefined> =>
  Promise.race([
    file.then(
      ({ data }) => data,
      () => undefined,
    ),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs).unref()),
  ])

/**
 * Fetches every downloadable result and leaves out each copy of a file
 * already listed higher up — the tab sites mirror each other, often under
 * other titles. A result whose file did not come in in time is kept as it is.
 */
const withoutCopies = async (
  downloadable: OnlineTab[],
  fetchFile: FetchFile,
  timeoutMs: number,
): Promise<OnlineTab[]> => {
  const deadline = Date.now() + timeoutMs
  const files = await mapWithLimit(downloadable, COMPARE_CONCURRENCY, (tab) => {
    const timeLeft = deadline - Date.now()
    return timeLeft > 0
      ? dataWithin(fetchFile(tab.source, tab.downloadPath!), timeLeft)
      : Promise.resolve(undefined)
  })

  const seen = new Set<string>()
  return downloadable.flatMap((tab, index) => {
    const data = files[index]
    if (!data) {
      return [tab]
    }

    const fingerprint = fingerprintOf(data)
    if (seen.has(fingerprint)) {
      return []
    }
    seen.add(fingerprint)

    return [{ ...tab, sizeBytes: data.byteLength, fingerprint }]
  })
}

export const searchTabs = async (
  query: SearchQuery,
  fetchPage: FetchPage,
  fetchFile?: FetchFile,
  { compareTimeoutMs = COMPARE_TIMEOUT_MS }: { compareTimeoutMs?: number } = {},
): Promise<SearchResponse> => {
  const entries = Object.entries(SOURCES) as [TabSource, SourceSearch][]
  const settled = await Promise.allSettled(entries.map(([, search]) => search(query, fetchPage)))

  const results: OnlineTab[] = []
  const failures: SearchResponse['failures'] = []

  settled.forEach((outcome, index) => {
    const source = entries[index]![0]
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value)
    } else {
      failures.push({
        source,
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      })
    }
  })

  const ranked = results.sort(rank)
  const downloadable = ranked.filter((tab) => tab.downloadPath)
  const distinct = fetchFile ? await withoutCopies(downloadable, fetchFile, compareTimeoutMs) : downloadable

  return {
    results: [...distinct.slice(0, MAX_DOWNLOADABLE), ...ranked.filter((tab) => !tab.downloadPath)],
    failures,
  }
}
