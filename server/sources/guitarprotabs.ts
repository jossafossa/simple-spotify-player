import { fetchWithRetry } from '../fetchPage.ts'
import { fileNameFrom, readFileResponse } from '../fileResponse.ts'
import { artistFactor, decodeHtml, titleScore } from '../text.ts'
import type { FileSource, OnlineTab, SourceSearch } from '../types.ts'

export const GUITARPROTABS_ORIGIN = 'https://guitarprotabs.org'

/** A song page: letter, artist, then the song with its number. */
export const GUITARPROTABS_SONG_PATH = /^\/[a-z0-9]\/[^/?#\s]+\/[^/?#\s]+_\d+\/$/
const MAX_RESULTS = 6

export type GuitarprotabsListing = {
  artist: string
  title: string
  path: string
  extension: string
  downloads: number | undefined
}

const ROW =
  /<a href="https:\/\/guitarprotabs\.org(\/[^"]+)" title="([^"]*)">[\s\S]*?<\/a><\/td>\s*<td><a [^>]*>([^<]*)<\/a><\/td>\s*<td>([^<]*)<\/td>\s*<td><span class="badge">([\d,]*)<\/span>/g

/** One table row per tab: song, artist, file type and how often it was downloaded. */
export const parseGuitarprotabsSearch = (html: string): GuitarprotabsListing[] =>
  [...html.matchAll(ROW)].map(([, path, titleAttribute, artist, extension, downloads]) => {
    const artistName = decodeHtml(artist!.trim())
    const title = decodeHtml(titleAttribute!)
      .replace(new RegExp(`\\s*by${artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      artist: artistName,
      title,
      path: decodeHtml(path!),
      extension: extension!.trim().replace(/^\./, ''),
      downloads: downloads ? Number(downloads.replace(/,/g, '')) : undefined,
    }
  })

const VERSION = /^(.*\S)\s+\((\d{1,2})\)$/

/**
 * guitarprotabs.org hands out Guitar Pro files without an account. Its
 * search only finds titles, and only one page of them is read, so a song
 * with a very common title may be missed; other sources cover those.
 */
export const searchGuitarprotabs: SourceSearch = async ({ artist, title }, fetchPage) => {
  const html = await fetchPage(
    `${GUITARPROTABS_ORIGIN}/search.php?search=${encodeURIComponent(title)}&in=songs`,
  )

  return parseGuitarprotabsSearch(html)
    .flatMap((listing): OnlineTab[] => {
      if (!GUITARPROTABS_SONG_PATH.test(listing.path)) {
        return []
      }

      const version = VERSION.exec(listing.title)
      const name = version ? version[1]! : listing.title
      const score = titleScore(title, name)
      if (score === 0) {
        return []
      }

      const kind = `Guitar Pro (.${listing.extension})`
      return [
        {
          id: `guitarprotabs:${listing.path}`,
          source: 'guitarprotabs',
          artist: listing.artist,
          title: name,
          kind: version ? `${kind} · version ${version[2]}` : kind,
          url: `${GUITARPROTABS_ORIGIN}${listing.path}`,
          downloadPath: listing.path,
          rating: undefined,
          votes: undefined,
          relevance: score * artistFactor(artist, listing.artist),
        },
      ]
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_RESULTS)
}

/** The cookies a page sets, as one Cookie header to send back. */
const cookiesOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')

/**
 * The download answers only a visitor who opened the song page first: it
 * wants that page's cookies and the page as referrer.
 */
export const guitarprotabsFiles: FileSource = {
  pathPattern: GUITARPROTABS_SONG_PATH,
  fetchFile: async (path, fetchImpl) => {
    const pageUrl = `${GUITARPROTABS_ORIGIN}${path}`
    const page = await fetchWithRetry(fetchImpl, pageUrl, { headers: { Accept: 'text/html' } })
    await page.arrayBuffer()

    const response = await fetchWithRetry(fetchImpl, `${pageUrl}download/`, {
      headers: { Cookie: cookiesOf(page), Referer: pageUrl },
      redirect: 'manual',
      timeoutMs: 15_000,
    })
    const data = await readFileResponse(response, 'guitarprotabs.org')
    const fallback = `${path.split('/').filter(Boolean).slice(1).join('-')}.gp5`

    return { data, fileName: fileNameFrom(response.headers.get('content-disposition'), fallback) }
  },
}
