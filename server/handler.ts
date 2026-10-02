import type { IncomingMessage, ServerResponse } from 'node:http'
import { createFetchPage, fetchWithRetry } from './fetchPage.ts'
import { searchTabs } from './searchTabs.ts'
import { GPROTAB_ORIGIN, GPROTAB_TAB_PATH } from './sources/gprotab.ts'

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
const MAX_QUERY_LENGTH = 200

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const fileNameFrom = (disposition: string | null, fallback: string): string => {
  const name = /filename="?([^";]+)"?/i.exec(disposition ?? '')?.[1]
  return name && /^[\w .-]+\.(gp[345x]?|ptb)$/i.test(name) ? name : fallback
}

/**
 * Proxies one GProTab file. The path is checked against the shape of a tab
 * page, so this can never be turned into a fetch of an arbitrary URL.
 */
const download = async (
  url: URL,
  response: ServerResponse,
  fetchImpl: typeof fetch,
): Promise<void> => {
  const path = url.searchParams.get('path') ?? ''
  if (!GPROTAB_TAB_PATH.test(path)) {
    sendJson(response, 400, { error: 'Not a GProTab tab path.' })
    return
  }

  const upstream = await fetchWithRetry(fetchImpl, `${GPROTAB_ORIGIN}${path}?download`, {
    headers: { Referer: `${GPROTAB_ORIGIN}${path}` },
    timeoutMs: 15_000,
  })
  const data = new Uint8Array(await upstream.arrayBuffer())

  if (!upstream.ok || data.byteLength === 0 || data.byteLength > MAX_DOWNLOAD_BYTES) {
    sendJson(response, 502, { error: `GProTab did not hand over the file (${upstream.status}).` })
    return
  }

  const fallback = `${path.split('/').slice(-2).join('-')}.gp5`
  response.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${fileNameFrom(upstream.headers.get('content-disposition'), fallback)}"`,
    'Content-Length': data.byteLength,
  })
  response.end(data)
}

export type TabSearchOptions = {
  /**
   * Origins the app may be served from when it is hosted apart from this
   * service. `*` allows any; unset, only same-origin requests are answered
   * with CORS headers left off.
   */
  allowedOrigins?: string[]
}

/**
 * Lets an app on another origin call the service. Every route is a plain GET
 * without credentials, so the browser only needs to be told which origin may
 * read the answer — and, for downloads, the header carrying the file name.
 */
const applyCors = (
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
): void => {
  const origin = request.headers.origin
  if (!origin || allowedOrigins.length === 0) {
    return
  }

  if (allowedOrigins.includes('*')) {
    response.setHeader('Access-Control-Allow-Origin', '*')
  } else if (allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  } else {
    return
  }

  response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
}

export type TabSearchHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void,
) => void

/**
 * The tab search API, mountable on a plain Node server or as Vite dev
 * middleware. Anything outside /api/tabs/ is passed on, or answered 404.
 */
export const createTabSearchHandler = (
  fetchImpl: typeof fetch = fetch,
  { allowedOrigins = [] }: TabSearchOptions = {},
): TabSearchHandler => {
  const fetchPage = createFetchPage(fetchImpl)

  return (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (!url.pathname.startsWith('/api/tabs/')) {
      if (next) {
        next()
      } else {
        sendJson(response, 404, { error: 'Not found.' })
      }
      return
    }

    applyCors(request, response, allowedOrigins)

    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET')
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Only GET is supported.' })
      return
    }

    const fail = (error: unknown) => {
      console.error('Tab search failed', error)
      if (!response.headersSent) {
        sendJson(response, 502, { error: 'The tab search failed.' })
      }
    }

    if (url.pathname === '/api/tabs/search') {
      const artist = (url.searchParams.get('artist') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
      const title = (url.searchParams.get('title') ?? '').trim().slice(0, MAX_QUERY_LENGTH)

      if (!title) {
        sendJson(response, 400, { error: 'A title is needed to search.' })
        return
      }

      searchTabs({ artist, title }, fetchPage)
        .then((result) => sendJson(response, 200, result))
        .catch(fail)
      return
    }

    if (url.pathname === '/api/tabs/download') {
      download(url, response, fetchImpl).catch(fail)
      return
    }

    if (url.pathname === '/api/tabs/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    sendJson(response, 404, { error: 'Not found.' })
  }
}
