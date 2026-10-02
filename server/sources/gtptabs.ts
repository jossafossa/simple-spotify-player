import { fetchWithRetry } from '../fetchPage.ts'
import { fileNameFrom, readFileResponse } from '../fileResponse.ts'
import { artistFactor, decodeHtml, isSameArtist, titleScore } from '../text.ts'
import type { FileSource, OnlineTab, SourceSearch } from '../types.ts'

export const GTPTABS_ORIGIN = 'https://gtptabs.com'

/** A download is asked for by the tab's number alone. */
export const GTPTABS_DOWNLOAD_PATH = /^\/tabs\/download\/\d+\.html$/
const ARTIST_PAGE = /href="(\/tabs\/\d+\/[a-z0-9-]+\.html)"/
/** Popular songs have a dozen uploads; only the best matches are kept. */
const MAX_RESULTS = 8

export type GtptabsListing = {
  /** As the page shows it: "Nightwish - Nemo (2)" in a search, "Nemo (2)" on an artist page. */
  text: string
  path: string
  itemId: string
  format: string
  stars: number
  sizeBytes: number | undefined
}

/**
 * Search results and artist pages list tabs the same way: one block per tab
 * with its format, page, number (which is also its download), stars and size.
 */
export const parseGtptabsListings = (html: string): GtptabsListing[] =>
  html
    .split('<div class="autorSong ')
    .slice(1)
    .flatMap((block): GtptabsListing[] => {
      const format = /^([a-z0-9]+)"/.exec(block)?.[1]
      const link = /<a href="(\/tabs\/\d+\/[a-z0-9-]+\/[a-z0-9-]+\.html)">([^<]*)<\/a>/.exec(block)
      const itemId = /data-item="(\d+)"/.exec(block)?.[1]
      if (!format || !link || !itemId) {
        return []
      }

      const kilobytes = /\(([\d.]+) Kb\)/.exec(block)?.[1]
      return [
        {
          text: decodeHtml(link[2]!.trim()),
          path: link[1]!,
          itemId,
          format,
          stars: block.match(/class="realActive active"/g)?.length ?? 0,
          sizeBytes: kilobytes ? Math.round(Number(kilobytes) * 1024) : undefined,
        },
      ]
    })

/** "Nemo (2)" is the second upload of Nemo; "Nemo (cover)" keeps its note. */
export const splitGtptabsVersion = (title: string): { name: string; version: number | undefined } => {
  const match = /^(.*\S)\s+\((\d{1,2})\)$/.exec(title)
  return match ? { name: match[1]!, version: Number(match[2]) } : { name: title, version: undefined }
}

const FORMAT_KINDS: Record<string, string> = {
  gp3: 'Guitar Pro 3',
  gp4: 'Guitar Pro 4',
  gp5: 'Guitar Pro 5',
  gpx: 'Guitar Pro 6',
  gp: 'Guitar Pro 7',
}

const searchUrl = (query: string, searchIn: 'artist' | 'tab') =>
  `${GTPTABS_ORIGIN}/search/go.html?SearchForm%5BsearchString%5D=${encodeURIComponent(query)}&SearchForm%5BsearchIn%5D=${searchIn}`

/**
 * gtptabs.com hands out Guitar Pro files without an account. Its title
 * search misses a song with a common title ("One"), so the artist's own page
 * is read too, found through the artist search.
 */
export const searchGtptabs: SourceSearch = async ({ artist, title }, fetchPage) => {
  const [titleHtml, artistHtml] = await Promise.all([
    fetchPage(searchUrl(title, 'tab')),
    artist ? findArtistPage(artist, fetchPage) : Promise.resolve(''),
  ])

  const fromArtist = parseGtptabsListings(artistHtml).map((listing) => ({ ...listing, artist }))
  const fromSearch = parseGtptabsListings(titleHtml).map((listing) => {
    const [found, ...rest] = listing.text.split(' - ')
    return rest.length > 0 ? { ...listing, artist: found!, text: rest.join(' - ') } : { ...listing, artist: '' }
  })

  const seen = new Set<string>()
  const results = [...fromArtist, ...fromSearch].flatMap((listing): OnlineTab[] => {
    if (seen.has(listing.itemId)) {
      return []
    }
    seen.add(listing.itemId)

    const { name, version } = splitGtptabsVersion(listing.text)
    const score = titleScore(title, name)
    if (score === 0) {
      return []
    }

    const kind = FORMAT_KINDS[listing.format] ?? 'Guitar Pro'
    return [
      {
        id: `gtptabs:${listing.itemId}`,
        source: 'gtptabs',
        artist: listing.artist,
        title: name,
        kind: version ? `${kind} · version ${version}` : kind,
        url: `${GTPTABS_ORIGIN}${listing.path}`,
        downloadPath: `/tabs/download/${listing.itemId}.html`,
        rating: listing.stars || undefined,
        votes: undefined,
        relevance: score * artistFactor(artist, listing.artist),
        sizeBytes: listing.sizeBytes,
      },
    ]
  })

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, MAX_RESULTS)
}

/** The artist search links the artist's page, whose number cannot be guessed. */
const findArtistPage = async (artist: string, fetchPage: (url: string) => Promise<string>) => {
  const html = await fetchPage(searchUrl(artist, 'artist')).catch(() => '')
  const links = [...html.matchAll(new RegExp(ARTIST_PAGE, 'g'))]
  const match = links.find(([, path]) => isSameArtist(artist, path!.split('/').pop()!.replace('.html', '').replace(/-/g, ' ')))
  return match ? fetchPage(`${GTPTABS_ORIGIN}${match[1]}`).catch(() => '') : ''
}

export const gtptabsFiles: FileSource = {
  pathPattern: GTPTABS_DOWNLOAD_PATH,
  fetchFile: async (path, fetchImpl) => {
    const response = await fetchWithRetry(fetchImpl, `${GTPTABS_ORIGIN}${path}`, { timeoutMs: 15_000 })
    const data = await readFileResponse(response, 'gtptabs')
    const fallback = `gtptabs-${/\d+/.exec(path)?.[0] ?? 'tab'}.gp5`

    return { data, fileName: fileNameFrom(response.headers.get('content-disposition'), fallback) }
  },
}
