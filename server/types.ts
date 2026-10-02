export type TabSource = 'gprotab' | 'songsterr' | 'ultimate-guitar'

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
