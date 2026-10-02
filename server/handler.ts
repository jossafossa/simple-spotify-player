import type { IncomingMessage, ServerResponse } from 'node:http'
import { createFetchPage } from './fetchPage.ts'
import { createFetchFile, NotDownloadableError, type FetchFile } from './files.ts'
import { searchTabs } from './searchTabs.ts'
import type { DownloadedFile, TabSource } from './types.ts'

const MAX_QUERY_LENGTH = 200

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

/**
 * Hands over one tab file, fetched from the site named. Each site checks the
 * path against the shape of its own tabs, so this can never be turned into
 * a fetch of an arbitrary URL.
 */
const download = async (url: URL, response: ServerResponse, fetchFile: FetchFile): Promise<void> => {
  const source = (url.searchParams.get('source') ?? 'gprotab') as TabSource
  const path = url.searchParams.get('path') ?? ''

  let file: DownloadedFile
  try {
    file = await fetchFile(source, path)
  } catch (error: unknown) {
    if (error instanceof NotDownloadableError) {
      sendJson(response, 400, { error: error.message })
      return
    }
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'The download failed.' })
    return
  }

  response.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    // A name made from a URL can hold anything; a header may not.
    'Content-Disposition': `attachment; filename="${file.fileName.replace(/[^\w .,()'&-]/g, '_')}"`,
    'Content-Length': file.data.byteLength,
  })
  response.end(file.data)
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
  const fetchFile = createFetchFile(fetchImpl)

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

      searchTabs({ artist, title }, fetchPage, fetchFile)
        .then((result) => sendJson(response, 200, result))
        .catch(fail)
      return
    }

    if (url.pathname === '/api/tabs/download') {
      download(url, response, fetchFile).catch(fail)
      return
    }

    if (url.pathname === '/api/tabs/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    sendJson(response, 404, { error: 'Not found.' })
  }
}
