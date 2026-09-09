import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watchWidevineLicense } from './widevineLicense'

const LICENSE_URL = 'https://api.spotify.com/v1/widevine-license/v1/audio/license'

const createListener = () => vi.fn<(isGranted: boolean) => void>()

/**
 * The interception installs once per page and captures `window.fetch` as it
 * finds it, so the stand-in has to be in place before the first subscription
 * and is reconfigured per test rather than replaced.
 */
const underlyingFetch = vi.fn<typeof window.fetch>()
window.fetch = underlyingFetch

let onResult = createListener()

/** Stands in for the XHR the SDK makes, with a status we control. */
const sendXhr = (url: string, status: number) => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url)
  Object.defineProperty(xhr, 'status', { value: status, configurable: true })
  xhr.dispatchEvent(new Event('loadend'))
}

beforeEach(() => {
  onResult = createListener()
  underlyingFetch.mockReset()
  underlyingFetch.mockResolvedValue({ ok: true, status: 200 } as Response)
})

describe('watchWidevineLicense', () => {
  it('reports a refused licence request', () => {
    const unwatch = watchWidevineLicense(onResult)

    sendXhr(LICENSE_URL, 403)
    unwatch()

    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('reports a granted licence, so an earlier failure can be undone', () => {
    const unwatch = watchWidevineLicense(onResult)

    sendXhr(LICENSE_URL, 200)
    unwatch()

    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('ignores every other request, whatever its status', () => {
    const unwatch = watchWidevineLicense(onResult)

    // A 403 from the playlist endpoint says nothing about DRM.
    sendXhr('https://api.spotify.com/v1/playlists/p1/items', 403)
    sendXhr('https://api.spotify.com/v1/me/player', 200)
    unwatch()

    expect(onResult).not.toHaveBeenCalled()
  })

  it('reports a refusal that arrives over fetch', async () => {
    underlyingFetch.mockResolvedValue({ ok: false, status: 403 } as Response)
    const unwatch = watchWidevineLicense(onResult)

    await window.fetch(LICENSE_URL, { method: 'POST' })
    unwatch()

    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('passes a fetch response through untouched', async () => {
    const response = { ok: true, status: 200 } as Response
    underlyingFetch.mockResolvedValue(response)
    const unwatch = watchWidevineLicense(onResult)

    await expect(window.fetch(LICENSE_URL)).resolves.toBe(response)
    unwatch()

    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('accepts a URL rather than a string', async () => {
    underlyingFetch.mockResolvedValue({ ok: false, status: 403 } as Response)
    const unwatch = watchWidevineLicense(onResult)

    await window.fetch(new URL(LICENSE_URL))
    unwatch()

    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('leaves unrelated fetches alone', async () => {
    underlyingFetch.mockResolvedValue({ ok: false, status: 500 } as Response)
    const unwatch = watchWidevineLicense(onResult)

    await window.fetch('https://api.spotify.com/v1/me/player')
    unwatch()

    expect(onResult).not.toHaveBeenCalled()
  })

  it('stops reporting to a listener that unsubscribed', () => {
    watchWidevineLicense(onResult)()

    sendXhr(LICENSE_URL, 403)

    expect(onResult).not.toHaveBeenCalled()
  })

  it('reports to every current listener', () => {
    const second = createListener()
    const unwatch = watchWidevineLicense(onResult)
    const unwatchSecond = watchWidevineLicense(second)

    sendXhr(LICENSE_URL, 403)
    unwatch()
    unwatchSecond()

    expect(onResult).toHaveBeenCalledWith(false)
    expect(second).toHaveBeenCalledWith(false)
  })

  it('still opens ordinary requests while watching', () => {
    const unwatch = watchWidevineLicense(onResult)

    const xhr = new XMLHttpRequest()
    expect(() => xhr.open('GET', 'https://example.com/thing')).not.toThrow()
    unwatch()
  })
})
