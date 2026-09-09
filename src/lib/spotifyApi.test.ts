import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchContextPlaylist,
  isSupportedContext,
  parseContextUri,
  playTrackInContext,
  SpotifyRequestError,
} from './spotifyApi'

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  }) as unknown as Response

const emptyResponse = (): Response => ({ ok: true, headers: new Headers() }) as unknown as Response

const errorResponse = (status: number): Response =>
  ({ ok: false, status, headers: new Headers() }) as unknown as Response

const playlistItem = (uri: string, name: string) => ({
  item: { uri, name, duration_ms: 1_000, artists: [{ name: 'Artist' }] },
})

/** Serves a playlist of `total` tracks, paged the way Spotify pages them. */
const stubPlaylistOfSize = (total: number, pageSize = 50) => {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (!url.includes('/items')) {
      return Promise.resolve(jsonResponse({ name: 'My Mix' }))
    }

    const offset = Number(new URL(url).searchParams.get('offset'))
    const items = Array.from(
      { length: Math.max(Math.min(pageSize, total - offset), 0) },
      (_unused, index) => playlistItem(`spotify:track:${offset + index}`, `Track ${offset + index}`),
    )

    return Promise.resolve(jsonResponse({ total, items }))
  })
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseContextUri', () => {
  it('splits a context uri into type and id', () => {
    expect(parseContextUri('spotify:playlist:abc123')).toEqual({ type: 'playlist', id: 'abc123' })
  })

  it('returns undefined for missing or malformed uris', () => {
    expect(parseContextUri(undefined)).toBeUndefined()
    expect(parseContextUri('')).toBeUndefined()
    expect(parseContextUri('spotify:playlist')).toBeUndefined()
    expect(parseContextUri('other:playlist:abc')).toBeUndefined()
  })
})

describe('isSupportedContext', () => {
  it('accepts playlists and albums but not other contexts', () => {
    expect(isSupportedContext({ type: 'playlist', id: 'a' })).toBe(true)
    expect(isSupportedContext({ type: 'album', id: 'a' })).toBe(true)
    expect(isSupportedContext({ type: 'artist', id: 'a' })).toBe(false)
    expect(isSupportedContext(undefined)).toBe(false)
  })
})

describe('fetchContextPlaylist', () => {
  it('reads a playlist name and its tracks', async () => {
    const fetchMock = stubPlaylistOfSize(1)

    const playlist = await fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })

    expect(playlist.name).toBe('My Mix')
    expect(playlist.tracks).toEqual([
      {
        uri: 'spotify:track:0',
        name: 'Track 0',
        artistNames: ['Artist'],
        durationMs: 1_000,
      },
    ])
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('reads the playlist listing from /items, not the removed /tracks', async () => {
    const fetchMock = stubPlaylistOfSize(1)

    await fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })

    const paths = fetchMock.mock.calls.map(([url]) => url)
    expect(paths.some((path) => path.includes('/playlists/p1/items'))).toBe(true)
    expect(paths.some((path) => path.includes('/playlists/p1/tracks'))).toBe(false)
  })

  it("uses the album response's embedded first page instead of asking twice", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/tracks')
          ? jsonResponse({ total: 1, items: [{ uri: 'spotify:track:9', name: 'Refetched' }] })
          : jsonResponse({
              name: 'The Album',
              tracks: {
                total: 2,
                items: [
                  { uri: 'spotify:track:1', name: 'One', duration_ms: 1_000 },
                  { uri: 'spotify:track:2', name: 'Two', duration_ms: 2_000 },
                ],
              },
            }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const playlist = await fetchContextPlaylist('token', { type: 'album', id: 'a1' })

    expect(playlist.tracks.map((track) => track.name)).toEqual(['One', 'Two'])
    // The album object already held every track, so one request was enough.
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('pages past an album first page that does not hold every track', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/tracks')
          ? jsonResponse({ total: 51, items: [{ uri: 'spotify:track:51', name: 'Track 51' }] })
          : jsonResponse({
              name: 'Long Album',
              tracks: {
                total: 51,
                items: Array.from({ length: 50 }, (_unused, index) => ({
                  uri: `spotify:track:${index}`,
                  name: `Track ${index}`,
                })),
              },
            }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const playlist = await fetchContextPlaylist('token', { type: 'album', id: 'a1' })

    expect(playlist.tracks).toHaveLength(51)
    expect(playlist.tracks[50]!.name).toBe('Track 51')
    // The album call plus exactly one page for the leftover track.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("carries Spotify's own explanation of a failure", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ error: { message: 'Insufficient client scope' } }),
        } as unknown as Response),
      ),
    )

    await expect(
      fetchContextPlaylist('token', { type: 'playlist', id: 'p1' }),
    ).rejects.toMatchObject({ status: 403, reason: 'Insufficient client scope' })
  })

  it('loads every page of a playlist far longer than one page', async () => {
    const fetchMock = stubPlaylistOfSize(1_250)

    const playlist = await fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })

    expect(playlist.tracks).toHaveLength(1_250)
    expect(playlist.tracks[0]!.name).toBe('Track 0')
    expect(playlist.tracks[1_249]!.name).toBe('Track 1249')

    // One details call plus a page per 50 tracks.
    expect(fetchMock).toHaveBeenCalledTimes(1 + 25)
  })

  it('keeps the playlist in its original order across pages', async () => {
    stubPlaylistOfSize(450)

    const playlist = await fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })

    expect(playlist.tracks.map((track) => track.name)).toEqual(
      Array.from({ length: 450 }, (_unused, index) => `Track ${index}`),
    )
  })

  it('skips removed and local tracks that cannot be played', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/items')
            ? jsonResponse({
                total: 3,
                items: [
                  { item: null },
                  playlistItem('spotify:local:x', 'Local File'),
                  playlistItem('spotify:track:1', 'Playable'),
                ],
              })
            : jsonResponse({ name: 'My Mix' }),
        ),
      ),
    )

    const playlist = await fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })

    expect(playlist.tracks.map((track) => track.name)).toEqual(['Playable'])
  })

  it('reads album tracks straight off the items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/tracks')
            ? jsonResponse({
                total: 1,
                items: [
                  {
                    uri: 'spotify:track:1',
                    name: 'Track One',
                    duration_ms: 2_000,
                    artists: [{ name: 'Artist' }],
                  },
                ],
              })
            : jsonResponse({ name: 'The Album' }),
        ),
      ),
    )

    const playlist = await fetchContextPlaylist('token', { type: 'album', id: 'a1' })

    expect(playlist.name).toBe('The Album')
    expect(playlist.tracks.map((track) => track.name)).toEqual(['Track One'])
  })

  it('rejects with the status so callers can tell a scope gap from a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(errorResponse(403))))

    await expect(
      fetchContextPlaylist('token', { type: 'playlist', id: 'p1' }),
    ).rejects.toThrow(SpotifyRequestError)
    await expect(fetchContextPlaylist('token', { type: 'playlist', id: 'p1' })).rejects.toMatchObject(
      { status: 403, path: expect.stringContaining('/playlists/p1') },
    )
  })
})

describe('playTrackInContext', () => {
  it('starts the chosen track while keeping the context queued', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(emptyResponse()))
    vi.stubGlobal('fetch', fetchMock)

    await playTrackInContext({
      accessToken: 'token',
      deviceId: 'device-1',
      contextUri: 'spotify:playlist:p1',
      trackUri: 'spotify:track:7',
    })

    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://api.spotify.com/v1/me/player/play?device_id=device-1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({
      context_uri: 'spotify:playlist:p1',
      offset: { uri: 'spotify:track:7' },
    })
  })
})
