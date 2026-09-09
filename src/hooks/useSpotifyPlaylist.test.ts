import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchContextPlaylist, SpotifyRequestError } from '~/lib/spotifyApi'
import { useSpotifyPlaylist } from './useSpotifyPlaylist'

vi.mock('~/lib/spotifyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/spotifyApi')>()),
  fetchContextPlaylist: vi.fn(),
}))

const mockedFetchContextPlaylist = vi.mocked(fetchContextPlaylist)

const playlist = { name: 'My Mix', tracks: [] }

describe('useSpotifyPlaylist', () => {
  beforeEach(() => {
    mockedFetchContextPlaylist.mockReset()
    mockedFetchContextPlaylist.mockResolvedValue(playlist)
  })

  it('is empty without a context to load', () => {
    const { result } = renderHook(() => useSpotifyPlaylist('token', undefined))

    expect(result.current.status).toBe('empty')
    expect(mockedFetchContextPlaylist).not.toHaveBeenCalled()
  })

  it('is empty without an access token', () => {
    const { result } = renderHook(() => useSpotifyPlaylist(undefined, 'spotify:playlist:p1'))

    expect(result.current.status).toBe('empty')
    expect(mockedFetchContextPlaylist).not.toHaveBeenCalled()
  })

  it('reports contexts it cannot list', () => {
    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:artist:a1'))

    expect(result.current.status).toBe('unsupported')
    expect(mockedFetchContextPlaylist).not.toHaveBeenCalled()
  })

  it('loads the playlist for the current context', async () => {
    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.playlist).toEqual(playlist)
    expect(mockedFetchContextPlaylist).toHaveBeenCalledWith('token', {
      type: 'playlist',
      id: 'p1',
    })
  })

  it('reports an error when loading fails', async () => {
    mockedFetchContextPlaylist.mockRejectedValue(new Error('nope'))

    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.playlist).toBeUndefined()
  })

  it('treats a 401 as an expired session rather than a scope problem', async () => {
    mockedFetchContextPlaylist.mockRejectedValue(new SpotifyRequestError(401, '/playlists/p1'))

    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    await waitFor(() => expect(result.current.status).toBe('expired'))
    expect(result.current.errorStatus).toBe(401)
  })

  it('treats a 403 as a refused playlist', async () => {
    mockedFetchContextPlaylist.mockRejectedValue(new SpotifyRequestError(403, '/playlists/p1/items', 'Insufficient client scope'))

    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    await waitFor(() => expect(result.current.status).toBe('forbidden'))
    expect(result.current.errorStatus).toBe(403)
    expect(result.current.errorReason).toBe('Insufficient client scope')
  })

  it('refetches when asked to reload after a failure', async () => {
    mockedFetchContextPlaylist.mockRejectedValueOnce(new SpotifyRequestError(500, '/playlists/p1'))

    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => {
      result.current.reload()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mockedFetchContextPlaylist).toHaveBeenCalledTimes(2)
  })

  it('treats a 404 as a playlist Spotify hides from apps', async () => {
    mockedFetchContextPlaylist.mockRejectedValue(new SpotifyRequestError(404, '/playlists/p1'))

    const { result } = renderHook(() => useSpotifyPlaylist('token', 'spotify:playlist:p1'))

    await waitFor(() => expect(result.current.status).toBe('inaccessible'))
  })

  it('keeps the loaded tracks on screen while a token refresh refetches', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useSpotifyPlaylist(token, 'spotify:playlist:p1'),
      { initialProps: { token: 'token-1' } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ token: 'token-2' })

    expect(result.current.status).toBe('ready')
    expect(result.current.playlist).toEqual(playlist)
  })

  it('refetches only when the context changes', async () => {
    const { result, rerender } = renderHook(
      ({ contextUri }: { contextUri: string }) => useSpotifyPlaylist('token', contextUri),
      { initialProps: { contextUri: 'spotify:playlist:p1' } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ contextUri: 'spotify:playlist:p1' })
    expect(mockedFetchContextPlaylist).toHaveBeenCalledOnce()

    rerender({ contextUri: 'spotify:playlist:p2' })
    await waitFor(() => expect(mockedFetchContextPlaylist).toHaveBeenCalledTimes(2))
  })
})
