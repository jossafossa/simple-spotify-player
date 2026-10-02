import type { OnlineTab, TabSource } from '../../server/types.ts'

export type { OnlineTab, TabSource }

export type OnlineSearchQuery = {
  artist: string
  title: string
}

export type OnlineSearchResult = {
  results: OnlineTab[]
  failures: { source: TabSource; message: string }[]
}

/**
 * Where the tab search service lives, e.g. "https://tabs.example.com". Empty
 * means the app's own origin, as under `pnpm dev` and `docker compose up`.
 */
const serviceUrl = (path: string): string =>
  `${(import.meta.env.VITE_TAB_SEARCH_URL ?? '').replace(/\/+$/, '')}${path}`

/** The tab search service is not answering, as opposed to answering with an error. */
export class TabSearchUnavailableError extends Error {
  constructor() {
    super('The tab search service is not running.')
    this.name = 'TabSearchUnavailableError'
  }
}

/**
 * A missing service shows up as a network error, or — behind Vite without
 * the API mounted — as the app's own HTML page instead of JSON.
 */
const requestJson = async <T>(url: string): Promise<T> => {
  let response: Response

  try {
    response = await fetch(url)
  } catch {
    throw new TabSearchUnavailableError()
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new TabSearchUnavailableError()
  }

  const body = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `The tab search answered ${response.status}.`)
  }

  return body
}

export const searchOnlineTabs = ({ artist, title }: OnlineSearchQuery): Promise<OnlineSearchResult> =>
  requestJson(
    serviceUrl(
      `/api/tabs/search?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
    ),
  )

const fileNameFrom = (disposition: string | null, fallback: string): string =>
  /filename="?([^";]+)"?/i.exec(disposition ?? '')?.[1] ?? fallback

/** Fetches a downloadable result through the service, as a file to add to the library. */
export const downloadOnlineTab = async (tab: OnlineTab): Promise<File> => {
  if (!tab.downloadPath) {
    throw new Error(`“${tab.title}” can only be opened on ${tab.source}, not downloaded.`)
  }

  let response: Response
  try {
    response = await fetch(
      serviceUrl(
        `/api/tabs/download?source=${encodeURIComponent(tab.source)}&path=${encodeURIComponent(tab.downloadPath)}`,
      ),
    )
  } catch {
    throw new TabSearchUnavailableError()
  }

  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Could not download “${tab.title}”.`)
  }

  const fileName = fileNameFrom(
    response.headers.get('content-disposition'),
    `${tab.artist} - ${tab.title}.gp5`,
  )
  return new File([await response.arrayBuffer()], fileName)
}

const SOURCE_NAMES: Record<TabSource, string> = {
  gprotab: 'GProTab',
  gtptabs: 'gtptabs',
  guitarprotabs: 'guitarprotabs.org',
  theguitarlesson: 'The Guitar Lesson',
  songsterr: 'Songsterr',
  'ultimate-guitar': 'Ultimate Guitar',
}

export const sourceName = (source: TabSource): string => SOURCE_NAMES[source]

/** "Nemo · GProTab version 2": tells two downloads of one song apart in the library. */
export const libraryNameFor = (tab: OnlineTab): string => {
  const version = /version (\d+)/.exec(tab.kind)?.[1]
  return `${tab.title} · ${sourceName(tab.source)}${version ? ` version ${version}` : ''}`
}

const NOISE_SUFFIX = /\s+-\s+.*\b(remaster(ed)?|live|version|edit|mono|stereo|mix|demo|acoustic|bonus)\b.*$/i
const NOISE_BRACKETS = /\s*[([][^)\]]*\b(feat\.?|ft\.|with|remaster(ed)?|live|version|edit|mono|stereo|mix|demo|bonus)\b[^)\]]*[)\]]/gi

/**
 * Spotify titles carry release details tab sites never use:
 * "Nemo - Remastered 2021" and "Song (feat. Someone)" both search as the song.
 */
export const cleanSongTitle = (title: string): string =>
  title.replace(NOISE_BRACKETS, '').replace(NOISE_SUFFIX, '').trim() || title
