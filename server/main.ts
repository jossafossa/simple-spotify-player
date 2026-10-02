import { createServer } from 'node:http'
import { createTabSearchHandler } from './handler.ts'
import { createStaticHandler } from './staticFiles.ts'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
// Comma-separated, e.g. "https://player.example.com"; "*" allows any origin.
// Only needed when the app is served from somewhere else than this server.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
// The built app, to serve it from here too; unset, this is the search alone.
const staticDir = process.env.STATIC_DIR

const handleTabSearch = createTabSearchHandler(fetch, { allowedOrigins })
const serveStatic = staticDir ? createStaticHandler(staticDir) : undefined

createServer((request, response) => {
  handleTabSearch(request, response, () => {
    if (!serveStatic) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not found.')
      return
    }

    serveStatic(request, response).catch((error: unknown) => {
      console.error('Could not serve', request.url, error)
      if (!response.headersSent) {
        response.writeHead(500)
      }
      response.end()
    })
  })
}).listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`)
  if (staticDir) {
    console.log(`Serving the app from ${staticDir}`)
  }
  if (allowedOrigins.length > 0) {
    console.log(`Answering apps served from: ${allowedOrigins.join(', ')}`)
  }
})
