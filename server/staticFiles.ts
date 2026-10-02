import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
}

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

/**
 * Serves the built app. Vite names everything under /assets/ by content
 * hash, so those may be cached for good; the rest — index.html above all —
 * is checked again each time, so a new build is picked up at once.
 */
export const createStaticHandler = (rootDir: string) => {
  const root = path.resolve(rootDir)

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }

    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      response.writeHead(400)
      response.end()
      return
    }

    const requested = path.resolve(root, `.${decoded}`)
    // Nothing outside the build may be served, however the path is spelled.
    if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
      response.writeHead(404)
      response.end()
      return
    }

    // The app has one page; any path without a file behind it gets that page,
    // which also answers Spotify's redirect back to the site root.
    const hasExtension = path.extname(decoded) !== ''
    const filePath = (await isFile(requested))
      ? requested
      : !hasExtension
        ? path.join(root, 'index.html')
        : undefined

    if (!filePath || !(await isFile(filePath))) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found.')
      return
    }

    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': decoded.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(filePath).pipe(response)
  }
}
