import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpotifyRequestError } from '~/lib/spotifyApi'
import { readSpotifyTempoUnavailable, saveSpotifyTempoUnavailable } from '~/lib/spotifyTempoStorage'
import { useSpotifyTempo } from './useSpotifyTempo'

describe('useSpotifyTempo', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it("hands on Spotify's tempo when asked", async () => {
    const onBpm = vi.fn()
    const loadBpm = vi.fn(() => Promise.resolve(123.4))
    const { result } = renderHook(() => useSpotifyTempo(loadBpm, onBpm))

    expect(loadBpm).not.toHaveBeenCalled()
    act(() => result.current.request())
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(onBpm).toHaveBeenCalledWith(123.4))
    expect(result.current.status).toBe('idle')
  })

  it('says so when Spotify has no tempo for the song', async () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useSpotifyTempo(() => Promise.resolve(undefined), onBpm))

    act(() => result.current.request())

    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(onBpm).not.toHaveBeenCalled()
  })

  it('stops asking once Spotify refuses this app audio features', async () => {
    const loadBpm = vi.fn(() => Promise.reject(new SpotifyRequestError(403, '/audio-features/x')))
    const { result } = renderHook(() => useSpotifyTempo(loadBpm, vi.fn()))

    act(() => result.current.request())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(readSpotifyTempoUnavailable()).toBe(true)

    act(() => result.current.request())
    expect(loadBpm).toHaveBeenCalledOnce()
  })

  it('starts out unavailable when Spotify refused before', () => {
    saveSpotifyTempoUnavailable()

    const { result } = renderHook(() => useSpotifyTempo(() => Promise.resolve(120), vi.fn()))

    expect(result.current.status).toBe('unavailable')
  })

  it('lets another failure be tried again', async () => {
    const loadBpm = vi.fn(() => Promise.reject(new SpotifyRequestError(500, '/audio-features/x')))
    const { result } = renderHook(() => useSpotifyTempo(loadBpm, vi.fn()))

    act(() => result.current.request())
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.request())
    expect(loadBpm).toHaveBeenCalledTimes(2)
  })
})
