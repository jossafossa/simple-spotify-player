import { artistFactor, decodeHtml, titleScore } from '../text.ts'
import { UpstreamError } from '../fetchPage.ts'
import type { OnlineTab, SourceSearch } from '../types.ts'

type UgResult = {
  id?: number
  type?: string
  song_name?: string
  artist_name?: string
  tab_url?: string
  rating?: number
  votes?: number
}

const KINDS: Record<string, string> = { Pro: 'Guitar Pro', Power: 'Power Tab' }
/** UG has dozens of versions of popular songs; only the best voted are kept. */
const MAX_RESULTS = 6

/** The search page embeds its results as JSON in a data attribute. */
export const parseUltimateGuitarSearch = (html: string): UgResult[] => {
  const store = /class="js-store" data-content="([^"]*)"/.exec(html)?.[1]
  if (!store) {
    return []
  }

  const data = JSON.parse(decodeHtml(store)) as {
    store?: { page?: { data?: { results?: UgResult[] } } }
  }
  return data.store?.page?.data?.results ?? []
}

/**
 * Only Guitar Pro and Power Tab results are kept — the formats the app can
 * store. Downloading them needs a signed-in account, so these are links.
 */
export const searchUltimateGuitar: SourceSearch = async ({ artist, title }, fetchPage) => {
  const value = encodeURIComponent(`${artist} ${title}`.trim())
  const html = await fetchPage(
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${value}`,
  ).catch((error: unknown) => {
    // UG answers a search with no results as a 404 page.
    if (error instanceof UpstreamError && error.status === 404) {
      return ''
    }
    throw error
  })
  const results = parseUltimateGuitarSearch(html)

  const tabs = results.flatMap((result): OnlineTab[] => {
    const kind = result.type && KINDS[result.type]
    if (!kind || !result.id || !result.tab_url || !result.song_name) {
      return []
    }

    const score = titleScore(title, result.song_name)
    if (score === 0) {
      return []
    }

    return [
      {
        id: `ultimate-guitar:${result.id}`,
        source: 'ultimate-guitar',
        artist: result.artist_name ?? '',
        title: result.song_name,
        kind,
        url: result.tab_url,
        downloadPath: undefined,
        rating: result.rating ? Math.round(result.rating * 10) / 10 : undefined,
        votes: result.votes || undefined,
        relevance: score * artistFactor(artist, result.artist_name ?? ''),
      },
    ]
  })

  return tabs
    .sort((a, b) => b.relevance - a.relevance || (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, MAX_RESULTS)
}
