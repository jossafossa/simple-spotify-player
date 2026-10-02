import { createServer } from 'node:http'
import { createTabSearchHandler } from './handler.ts'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
// Comma-separated, e.g. "https://player.example.com"; "*" allows any origin.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const handleTabSearch = createTabSearchHandler(fetch, { allowedOrigins })

createServer((request, response) => handleTabSearch(request, response)).listen(port, host, () => {
  console.log(`Tab search listening on http://${host}:${port}`)
  if (allowedOrigins.length > 0) {
    console.log(`Answering apps served from: ${allowedOrigins.join(', ')}`)
  }
})
