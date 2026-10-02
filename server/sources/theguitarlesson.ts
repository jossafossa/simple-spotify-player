import { fetchWithRetry } from '../fetchPage.ts'
import { fileNameFrom, readFileResponse } from '../fileResponse.ts'
import { artistFactor, decodeHtml, titleScore } from '../text.ts'
import type { FileSource, OnlineTab, SourceSearch } from '../types.ts'

export const THEGUITARLESSON_ORIGIN = 'https://www.theguitarlesson.com'
const BASE = `${THEGUITARLESSON_ORIGIN}/guitar-pro-tabs`

/** A tab's post: letter, artist, song. */
export const THEGUITARLESSON_POST_PATH = /^\/guitar-pro-tabs\/[a-z0-9]\/[a-z0-9-]+\/[a-z0-9-]+\/$/
const FILE_LINK = /href="(https:\/\/www\.theguitarlesson\.com\/guitar-pro-tabs\/song-files\/[^"]+\.(?:gp[345x]?|ptb))"/i
const MAX_RESULTS = 6

type SearchHit = { title?: string; url?: string }

const VERSION = /^(.*\S)\s+\((\d{1,2})\)$/

/** Titles come as "Nemo (2) – Nightwish": the song, then the artist after the last dash. */
export const splitPostTitle = (title: string): { artist: string; title: string } => {
  const decoded = decodeHtml(title)
  const at = decoded.lastIndexOf(' – ')
  return at === -1
    ? { artist: '', title: decoded.trim() }
    : { artist: decoded.slice(at + 3).trim(), title: decoded.slice(0, at).trim() }
}

/**
 * theguitarlesson.com keeps Guitar Pro files at plain URLs, and its
 * WordPress search answers in JSON — artist and title together find a song
 * even when the title alone is common.
 */
export const searchTheguitarlesson: SourceSearch = async ({ artist, title }, fetchPage) => {
  const query = encodeURIComponent(`${artist} ${title}`.trim())
  const body = await fetchPage(`${BASE}/wp-json/wp/v2/search?search=${query}&per_page=20`)
  const hits = JSON.parse(body) as SearchHit[]
  const seen = new Set<string>()

  return hits
    .flatMap((hit): OnlineTab[] => {
      const path = hit.url?.replace(THEGUITARLESSON_ORIGIN, '')
      if (!hit.title || !path || !THEGUITARLESSON_POST_PATH.test(path) || seen.has(path)) {
        return []
      }
      seen.add(path)

      const post = splitPostTitle(hit.title)
      const version = VERSION.exec(post.title)
      const name = version ? version[1]! : post.title
      const score = titleScore(title, name)
      if (score === 0) {
        return []
      }

      return [
        {
          id: `theguitarlesson:${path}`,
          source: 'theguitarlesson',
          artist: post.artist,
          title: name,
          kind: version ? `Guitar Pro · version ${version[2]}` : 'Guitar Pro',
          url: `${THEGUITARLESSON_ORIGIN}${path}`,
          downloadPath: path,
          rating: undefined,
          votes: undefined,
          relevance: score * artistFactor(artist, post.artist),
        },
      ]
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_RESULTS)
}

/** The post links its file, named "Artist - Title.gp4", under song-files. */
export const findTheguitarlessonFile = (html: string): string | undefined => {
  const href = FILE_LINK.exec(html)?.[1]
  return href && encodeURI(decodeURI(decodeHtml(href)))
}

export const theguitarlessonFiles: FileSource = {
  pathPattern: THEGUITARLESSON_POST_PATH,
  fetchFile: async (path, fetchImpl) => {
    const page = await fetchWithRetry(fetchImpl, `${THEGUITARLESSON_ORIGIN}${path}`, {
      headers: { Accept: 'text/html' },
    })
    const fileUrl = findTheguitarlessonFile(await page.text())
    if (!page.ok || !fileUrl) {
      throw new Error(`theguitarlesson.com has no file on ${path} (${page.status}).`)
    }

    const response = await fetchWithRetry(fetchImpl, fileUrl, { timeoutMs: 15_000 })
    const data = await readFileResponse(response, 'theguitarlesson.com')
    const fallback = decodeURIComponent(fileUrl.split('/').pop()!)

    return { data, fileName: fileNameFrom(response.headers.get('content-disposition'), fallback) }
  },
}
