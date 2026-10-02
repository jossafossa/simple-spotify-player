export type TabSource =
  | 'gprotab'
  | 'gtptabs'
  | 'guitarprotabs'
  | 'theguitarlesson'
  | 'songsterr'
  | 'ultimate-guitar'

/** One tab found online, ready for the app to list. */
export type OnlineTab = {
  /** Unique across sources. */
  id: string
  source: TabSource
  artist: string
  title: string
  /** e.g. "Guitar Pro", "Power Tab", or the instruments Songsterr has. */
  kind: string
  /** The tab's own page, to open in a browser. */
  url: string
  /** Set when the file can be fetched through this server's download route. */
  downloadPath: string | undefined
  /** The file's size, once the search has fetched it. */
  sizeBytes?: number
  /** SHA-256 of the file, once the search has fetched it; copies share it. */
  fingerprint?: string
  rating: number | undefined
  votes: number | undefined
  /** 0–1, higher is a better match for what was searched. */
  relevance: number
}

export type SearchQuery = {
  artist: string
  title: string
}

export type SourceSearch = (query: SearchQuery, fetchPage: FetchPage) => Promise<OnlineTab[]>

/** Fetches a URL as text; injected so sources can be tested without the network. */
export type FetchPage = (url: string) => Promise<string>

/** A tab file as fetched from its site. */
export type DownloadedFile = {
  data: Uint8Array
  fileName: string
}

/**
 * How one source hands over its files. The path is checked against the
 * pattern first, so the download route can never be made to fetch anything
 * but a tab of that site.
 */
export type FileSource = {
  pathPattern: RegExp
  fetchFile: (path: string, fetchImpl: typeof fetch) => Promise<DownloadedFile>
}
