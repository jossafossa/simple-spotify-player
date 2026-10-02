import { artistFactor, decodeHtml, slugify, titleScore } from '../text.ts'
import type { OnlineTab, SourceSearch } from '../types.ts'

export const GPROTAB_ORIGIN = 'https://gprotab.net'

/** Only tab pages: the one shape of path the download route will fetch. */
export const GPROTAB_TAB_PATH = /^\/en\/tabs\/[a-z0-9-]+\/[a-z0-9-]+$/

type Listing = { artist: string; title: string; path: string }

const ARTIST_LINK = /href="\/en\/tabs\/[a-z0-9-]+" class="tab-band">([^<]*)<\/a>\s*<a href="(\/en\/tabs\/[a-z0-9-]+\/[a-z0-9-]+)" class="tab-name">([^<]*)</g

/** The search page: title matches across every artist. */
export const parseGprotabSearch = (html: string): Listing[] =>
  [...html.matchAll(ARTIST_LINK)].map(([, artist, path, title]) => ({
    artist: decodeHtml(artist!.trim()),
    title: decodeHtml(title!.trim()),
    path: path!,
  }))

/** An artist page: every song that artist has a tab for. */
export const parseGprotabArtist = (html: string, artistSlug: string, artistName: string): Listing[] => {
  const songLink = new RegExp(`href="(/en/tabs/${artistSlug}/[a-z0-9-]+)"[^>]*>([^<]+)<`, 'g')

  return [...html.matchAll(songLink)].map(([, path, title]) => ({
    artist: artistName,
    title: decodeHtml(title!.trim()),
    path: path!,
  }))
}

/**
 * GProTab files a second upload of a song as "Nemo 2", "Nemo 3"; those are
 * versions of the song, not songs with a 2 in the name.
 */
export const splitVersion = (title: string): { name: string; version: number | undefined } => {
  const match = /^(.*\S)\s+(\d{1,2})$/.exec(title)
  return match ? { name: match[1]!, version: Number(match[2]) } : { name: title, version: undefined }
}

/**
 * GProTab hands out Guitar Pro files to anyone, no account needed, which
 * makes it the source of actual files. Its search only matches titles, so
 * the artist's own page is read too — that finds the song even when its
 * title is too common to surface in the search.
 */
export const searchGprotab: SourceSearch = async ({ artist, title }, fetchPage) => {
  const artistSlug = slugify(artist)
  const [searchHtml, artistHtml] = await Promise.all([
    fetchPage(`${GPROTAB_ORIGIN}/en/search?q=${encodeURIComponent(title)}`),
    artistSlug
      ? fetchPage(`${GPROTAB_ORIGIN}/en/tabs/${artistSlug}`).catch(() => '')
      : Promise.resolve(''),
  ])

  const listings = [
    ...parseGprotabArtist(artistHtml, artistSlug, artist),
    ...parseGprotabSearch(searchHtml),
  ]
  const seen = new Set<string>()

  return listings.flatMap((listing): OnlineTab[] => {
    if (seen.has(listing.path) || !GPROTAB_TAB_PATH.test(listing.path)) {
      return []
    }
    seen.add(listing.path)

    const { name, version } = splitVersion(listing.title)
    const score = titleScore(title, name)
    if (score === 0) {
      return []
    }

    return [
      {
        id: `gprotab:${listing.path}`,
        source: 'gprotab',
        artist: listing.artist,
        title: name,
        kind: version ? `Guitar Pro · version ${version}` : 'Guitar Pro',
        url: `${GPROTAB_ORIGIN}${listing.path}`,
        downloadPath: listing.path,
        rating: undefined,
        votes: undefined,
        relevance: score * artistFactor(artist, listing.artist),
      },
    ]
  })
}
