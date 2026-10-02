import { fileNameFrom, readFileResponse } from '../fileResponse.ts'
import { fetchWithRetry, UpstreamError } from '../fetchPage.ts'
import { artistFactor, decodeHtml, titleScore } from '../text.ts'
import type { FileSource, OnlineTab, SourceSearch } from '../types.ts'

export const UG_TABS_ORIGIN = 'https://tabs.ultimate-guitar.com'
/** A tab page: artist, then the song with the tab's number. */
export const UG_TAB_PATH = /^\/tab\/[a-z0-9-]+\/[a-z0-9-]+-\d+$/
/** The signed token a public tab page carries for its file. */
const BINARY_ID = /^[A-Za-z0-9%._~-]+$/

type UgResult = {
  id?: number
  type?: string
  song_name?: string
  artist_name?: string
  tab_url?: string
  rating?: number
  votes?: number
  /** "public" for tabs anyone may download; official and paid tabs are not. */
  tab_access_type?: string
  /** UG numbers the uploads of one song: version 1, 2, … */
  version?: number
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

/** Where a tab page lives on its own host, when it has the shape of one. */
const tabPathOf = (tabUrl: string): string | undefined => {
  const path = tabUrl.startsWith(UG_TABS_ORIGIN) ? tabUrl.slice(UG_TABS_ORIGIN.length) : undefined
  return path && UG_TAB_PATH.test(path) ? path : undefined
}

/**
 * Only Guitar Pro and Power Tab results are kept — the formats the app can
 * store. A public one can be downloaded with no account; official and paid
 * tabs are left as links.
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
        kind: result.version && result.version > 1 ? `${kind} · version ${result.version}` : kind,
        url: result.tab_url,
        downloadPath: result.tab_access_type === 'public' ? tabPathOf(result.tab_url) : undefined,
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

/** The tab page embeds its data, the file's download token among it, as JSON. */
export const findUltimateGuitarBinaryId = (html: string): string | undefined => {
  const store = /class="js-store" data-content="([^"]*)"/.exec(html)?.[1]
  if (!store) {
    return undefined
  }

  const data = JSON.parse(decodeHtml(store)) as {
    store?: { page?: { data?: { tab_view?: { binary_id?: string } } } }
  }
  const binaryId = data.store?.page?.data?.tab_view?.binary_id
  return binaryId && BINARY_ID.test(binaryId) ? binaryId : undefined
}

/**
 * A public tab's page carries a signed token for its file, which the
 * download hands over to anyone sent from that page.
 */
export const ultimateGuitarFiles: FileSource = {
  pathPattern: UG_TAB_PATH,
  fetchFile: async (path, fetchImpl) => {
    const pageUrl = `${UG_TABS_ORIGIN}${path}`
    const page = await fetchWithRetry(fetchImpl, pageUrl, { headers: { Accept: 'text/html' } })
    const binaryId = page.ok ? findUltimateGuitarBinaryId(await page.text()) : undefined
    if (!binaryId) {
      throw new Error(`Ultimate Guitar offers no file on ${path} (${page.status}).`)
    }

    const response = await fetchWithRetry(fetchImpl, `${UG_TABS_ORIGIN}/tab/download?id=${binaryId}`, {
      headers: { Referer: pageUrl },
      timeoutMs: 15_000,
    })
    const data = await readFileResponse(response, 'Ultimate Guitar')
    const fallback = `${path.split('/').pop()}.gp5`

    return { data, fileName: fileNameFrom(response.headers.get('content-disposition'), fallback) }
  },
}
