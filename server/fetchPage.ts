import type { FetchPage } from './types.ts'

const USER_AGENT =
  'Mozilla/5.0 (compatible; simple-spotify-player tab search; personal use)'
const TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 10 * 60_000
const CACHE_LIMIT = 200

export class UpstreamError extends Error {
  status: number

  constructor(url: string, status: number) {
    super(`${new URL(url).hostname} answered ${status}`)
    this.name = 'UpstreamError'
    this.status = status
  }
}

const isDroppedConnection = (error: unknown): boolean =>
  error instanceof TypeError &&
  (error.cause as { code?: string } | undefined)?.code === 'UND_ERR_SOCKET'

/**
 * Tab sites close idle keep-alive connections without notice, and the next
 * request on that socket fails at once. One retry opens a fresh connection.
 */
export const fetchWithRetry = async (
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> => {
  const attempt = () =>
    fetchImpl(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
    })

  try {
    return await attempt()
  } catch (error: unknown) {
    if (!isDroppedConnection(error)) {
      throw error
    }
    return attempt()
  }
}

/**
 * Fetches pages with a timeout, and remembers them for a while: typing the
 * same search twice, or two sources asking for one page, costs the tab sites
 * one request.
 */
export const createFetchPage = (fetchImpl: typeof fetch = fetch): FetchPage => {
  const cache = new Map<string, { expiresAt: number; body: Promise<string> }>()

  return (url) => {
    const cached = cache.get(url)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.body
    }

    const body = fetchWithRetry(fetchImpl, url, {
      headers: { Accept: 'text/html,application/json' },
    }).then(async (response) => {
      if (!response.ok) {
        throw new UpstreamError(url, response.status)
      }
      return response.text()
    })

    // A failure is not worth remembering; the next search should try again.
    body.catch(() => cache.delete(url))

    if (cache.size >= CACHE_LIMIT) {
      cache.delete(cache.keys().next().value!)
    }
    cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, body })

    return body
  }
}
