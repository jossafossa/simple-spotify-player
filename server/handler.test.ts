import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTabSearchHandler } from './handler.ts'

let server: Server | undefined

const serve = async (fetchImpl: typeof fetch, allowedOrigins: string[] = []) => {
  const handler = createTabSearchHandler(fetchImpl, { allowedOrigins })
  server = createServer((request, response) => handler(request, response))
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init)
}

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server!.close(resolve))
    server = undefined
  }
})

const gp5 = new Uint8Array([0x18, ...new TextEncoder().encode('FICHIER GUITAR PRO v5.00')])

describe('tab search handler', () => {
  it('needs a title to search', async () => {
    const request = await serve(vi.fn() as unknown as typeof fetch)

    const response = await request('/api/tabs/search?artist=Nightwish')

    expect(response.status).toBe(400)
  })

  it('answers a search with ranked results', async () => {
    const fetchImpl = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          url.includes('songsterr') || url.includes('theguitarlesson')
            ? '[]'
            : url.includes('/en/tabs/nightwish')
              ? '<a href="/en/tabs/nightwish/nemo">Nemo</a>'
              : '',
        ),
      ),
    )
    const request = await serve(fetchImpl as unknown as typeof fetch)

    const response = await request('/api/tabs/search?artist=Nightwish&title=Nemo')
    const body = (await response.json()) as { results: { id: string }[]; failures: unknown[] }

    expect(response.headers.get('content-type')).toContain('application/json')
    expect(body.results.map((tab) => tab.id)).toEqual(['gprotab:/en/tabs/nightwish/nemo'])
    expect(body.failures).toEqual([])
  })

  it('downloads a GProTab file under its own name', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(gp5, {
          headers: { 'Content-Disposition': 'attachment; filename="nightwish-nemo.gp5"' },
        }),
      ),
    )
    const request = await serve(fetchImpl as unknown as typeof fetch)

    const response = await request('/api/tabs/download?path=/en/tabs/nightwish/nemo')

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gprotab.net/en/tabs/nightwish/nemo?download',
      expect.objectContaining({ headers: expect.objectContaining({ Referer: 'https://gprotab.net/en/tabs/nightwish/nemo' }) }),
    )
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="nightwish-nemo.gp5"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(gp5)
  })

  it.each(['https://evil.example/x', '/en/tabs/../../etc', '/en/users/someone', '/en/tabs/nightwish'])(
    'refuses to fetch %s',
    async (path) => {
      const fetchImpl = vi.fn()
      const request = await serve(fetchImpl as unknown as typeof fetch)

      const response = await request(`/api/tabs/download?path=${encodeURIComponent(path)}`)

      expect(response.status).toBe(400)
      expect(fetchImpl).not.toHaveBeenCalled()
    },
  )

  it('downloads from the source named, and refuses one without files', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(gp5, { headers: { 'Content-Disposition': 'attachment; filename=nightwish-nemo.gp4' } }),
      ),
    )
    const request = await serve(fetchImpl as unknown as typeof fetch)

    const response = await request('/api/tabs/download?source=gtptabs&path=%2Ftabs%2Fdownload%2F12952.html')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="nightwish-nemo.gp4"')
    expect(fetchImpl).toHaveBeenCalledWith('https://gtptabs.com/tabs/download/12952.html', expect.anything())

    const refused = await request('/api/tabs/download?source=songsterr&path=%2Fx')
    expect(refused.status).toBe(400)
  })

  it('reports an empty download as a failure', async () => {
    const request = await serve(vi.fn(() => Promise.resolve(new Response(''))) as unknown as typeof fetch)

    const response = await request('/api/tabs/download?path=/en/tabs/nightwish/nemo')

    expect(response.status).toBe(502)
  })

  it('passes other paths on when mounted as middleware', () => {
    const handler = createTabSearchHandler(vi.fn() as unknown as typeof fetch)
    const next = vi.fn()

    handler({ url: '/src/main.tsx', method: 'GET' } as never, {} as never, next)

    expect(next).toHaveBeenCalledOnce()
  })

  describe('when the app is hosted on another origin', () => {
    const fetchSongsterrOnly = vi.fn(() => Promise.resolve(new Response('[]'))) as unknown as typeof fetch

    it('lets an allowed origin read the answer and the file name', async () => {
      const request = await serve(fetchSongsterrOnly, ['https://player.example.com'])

      const response = await request('/api/tabs/search?title=Nemo', {
        headers: { Origin: 'https://player.example.com' },
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('https://player.example.com')
      expect(response.headers.get('access-control-expose-headers')).toBe('Content-Disposition')
      expect(response.headers.get('vary')).toBe('Origin')
    })

    it('leaves other origins without CORS headers', async () => {
      const request = await serve(fetchSongsterrOnly, ['https://player.example.com'])

      const response = await request('/api/tabs/search?title=Nemo', {
        headers: { Origin: 'https://elsewhere.example' },
      })

      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('allows any origin with *', async () => {
      const request = await serve(fetchSongsterrOnly, ['*'])

      const response = await request('/api/tabs/health', { headers: { Origin: 'https://a.example' } })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })

    it('answers a preflight', async () => {
      const request = await serve(fetchSongsterrOnly, ['*'])

      const response = await request('/api/tabs/search', {
        method: 'OPTIONS',
        headers: { Origin: 'https://a.example' },
      })

      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-methods')).toBe('GET')
    })
  })
})
