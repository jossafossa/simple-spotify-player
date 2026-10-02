import { searchGprotab } from './sources/gprotab.ts'
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
  songsterr: searchSongsterr,
  'ultimate-guitar': searchUltimateGuitar,
}

const MAX_RESULTS = 30

/**
 * Best match first; between equally good matches, a file that can be
 * downloaded beats a link, and a well-voted tab beats an unrated one.
 */
const rank = (a: OnlineTab, b: OnlineTab): number =>
  b.relevance - a.relevance ||
  Number(!!b.downloadPath) - Number(!!a.downloadPath) ||
  (b.votes ?? 0) - (a.votes ?? 0)

export const searchTabs = async (
  query: SearchQuery,
  fetchPage: FetchPage,
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

  return { results: results.sort(rank).slice(0, MAX_RESULTS), failures }
}
