import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createStaticHandler } from './staticFiles.ts'

let server: Server
let base: string
let parent: string

beforeAll(async () => {
  parent = await mkdtemp(path.join(tmpdir(), 'static-'))
  const root = path.join(parent, 'dist')
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeFile(path.join(root, 'index.html'), '<!doctype html>app')
  await writeFile(path.join(root, 'assets', 'index-abc.js'), 'console.log(1)')
  await writeFile(path.join(root, 'favicon.svg'), '<svg/>')
  await writeFile(path.join(parent, 'secret.txt'), 'secret')

  const serve = createStaticHandler(root)
  server = createServer((request, response) => void serve(request, response))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(parent, { recursive: true, force: true })
})

describe('static files', () => {
  it('serves the app page, also for the redirect back from Spotify', async () => {
    for (const url of ['/', '/?code=abc&state=xyz', '/some/page']) {
      const response = await fetch(base + url)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(await response.text()).toBe('<!doctype html>app')
    }
  })

  it('serves hashed assets to be cached for good, and other files with their type', async () => {
    const asset = await fetch(`${base}/assets/index-abc.js`)
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(asset.headers.get('content-type')).toBe('text/javascript; charset=utf-8')

    const icon = await fetch(`${base}/favicon.svg`)
    expect(icon.headers.get('content-type')).toBe('image/svg+xml')
  })

  it('answers a missing file with 404, not the app page', async () => {
    expect((await fetch(`${base}/missing.js`)).status).toBe(404)
  })

  it('never serves anything outside the build', async () => {
    for (const url of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/assets/..%2f..%2fsecret.txt']) {
      const response = await fetch(base + url)
      expect(await response.text()).not.toBe('secret')
    }
  })

  it('only answers GET and HEAD', async () => {
    expect((await fetch(base, { method: 'POST' })).status).toBe(405)
    expect((await fetch(base, { method: 'HEAD' })).status).toBe(200)
  })
})
