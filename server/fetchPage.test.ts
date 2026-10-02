import { describe, expect, it, vi } from 'vitest'
import { createFetchPage, fetchWithRetry, UpstreamError } from './fetchPage.ts'

const ok = (body: string) => new Response(body, { status: 200 })
const droppedSocket = () =>
  Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_SOCKET' } })

describe('fetchPage', () => {
  it('fetches once and serves repeats from its cache', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(ok('page')))
    const fetchPage = createFetchPage(fetchImpl as unknown as typeof fetch)

    expect(await fetchPage('https://a.example/x')).toBe('page')
    expect(await fetchPage('https://a.example/x')).toBe('page')

    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('reports an error status, and does not cache it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(ok('recovered'))
    const fetchPage = createFetchPage(fetchImpl as unknown as typeof fetch)

    await expect(fetchPage('https://a.example/x')).rejects.toBeInstanceOf(UpstreamError)
    await expect(fetchPage('https://a.example/x')).resolves.toBe('recovered')
  })
})

describe('fetchWithRetry', () => {
  it('retries once when a kept-alive connection was dropped', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(droppedSocket()).mockResolvedValueOnce(ok('second'))

    const response = await fetchWithRetry(fetchImpl as unknown as typeof fetch, 'https://a.example', {})

    expect(await response.text()).toBe('second')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry other failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('DNS'))

    await expect(
      fetchWithRetry(fetchImpl as unknown as typeof fetch, 'https://a.example', {}),
    ).rejects.toThrow('DNS')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})
