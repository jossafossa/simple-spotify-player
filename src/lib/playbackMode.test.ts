import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectWidevineSupport, resolveDefaultPlaybackMode } from './playbackMode'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveDefaultPlaybackMode', () => {
  it('plays in the page when Widevine is there and has not let us down', () => {
    expect(
      resolveDefaultPlaybackMode({ isWidevineSupported: true, hasLocalPlaybackFailed: false }),
    ).toBe('local')
  })

  it('controls another device when Widevine is missing', () => {
    expect(
      resolveDefaultPlaybackMode({ isWidevineSupported: false, hasLocalPlaybackFailed: false }),
    ).toBe('remote')
  })

  it('controls another device when playing here has already stalled', () => {
    // Zen reports Widevine but cannot get a licence, so only the past failure
    // distinguishes it from a browser that genuinely works.
    expect(
      resolveDefaultPlaybackMode({ isWidevineSupported: true, hasLocalPlaybackFailed: true }),
    ).toBe('remote')
  })
})

describe('detectWidevineSupport', () => {
  it('reports support when the browser grants Widevine access', async () => {
    const requestAccess = vi.fn().mockResolvedValue({})
    vi.stubGlobal('navigator', { requestMediaKeySystemAccess: requestAccess })

    await expect(detectWidevineSupport()).resolves.toBe(true)
    expect(requestAccess).toHaveBeenCalledWith('com.widevine.alpha', expect.any(Array))
  })

  it('reports no support when the request is refused', async () => {
    vi.stubGlobal('navigator', {
      requestMediaKeySystemAccess: vi.fn().mockRejectedValue(new Error('unsupported')),
    })

    await expect(detectWidevineSupport()).resolves.toBe(false)
  })

  it('reports no support when the API is missing entirely', async () => {
    vi.stubGlobal('navigator', {})

    await expect(detectWidevineSupport()).resolves.toBe(false)
  })
})
