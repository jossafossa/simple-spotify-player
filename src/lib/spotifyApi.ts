import type { Playlist, PlaylistTrack } from './types'

const API_BASE = 'https://api.spotify.com/v1'
/** Both listing endpoints cap a page at 50 items. */
const PAGE_SIZE = 50
/** Pages are fetched in batches this wide to stay clear of rate limiting. */
const PAGE_BATCH_SIZE = 5

/** Context types we can both list and start playback from. */
const SUPPORTED_CONTEXT_TYPES = ['playlist', 'album']

export type SpotifyContext = {
  type: string
  id: string
}

export class SpotifyRequestError extends Error {
  status: number
  path: string
  /** Spotify's own explanation, which is far more specific than the status. */
  reason: string | undefined

  constructor(status: number, path: string, reason?: string) {
    super(
      `Spotify request to ${path} failed with status ${status}` +
        (reason ? `: ${reason}` : ''),
    )
    this.name = 'SpotifyRequestError'
    this.status = status
    this.path = path
    this.reason = reason
  }
}

type ApiErrorBody = {
  error?: { message?: string | null } | null
}

const readErrorReason = async (response: Response): Promise<string | undefined> => {
  try {
    const body = (await response.json()) as ApiErrorBody
    return body.error?.message ?? undefined
  } catch {
    return undefined
  }
}

export const parseContextUri = (contextUri: string | undefined): SpotifyContext | undefined => {
  const parts = contextUri?.split(':')

  if (!parts || parts.length !== 3 || parts[0] !== 'spotify' || !parts[1] || !parts[2]) {
    return undefined
  }

  return { type: parts[1], id: parts[2] }
}

export const isSupportedContext = (context: SpotifyContext | undefined): boolean =>
  !!context && SUPPORTED_CONTEXT_TYPES.includes(context.type)

const request = async <T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new SpotifyRequestError(response.status, path, await readErrorReason(response))
  }

  // Playback commands answer 202/204 with an empty body.
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return undefined as T
  }

  return (await response.json()) as T
}

type ApiTrack = {
  id?: string | null
  uri?: string | null
  name?: string | null
  duration_ms?: number | null
  artists?: { name: string }[] | null
  album?: { name?: string | null; images?: { url: string }[] | null } | null
}

/** The February 2026 API renamed the listing's `track` field to `item`. */
type ApiPlaylistItem = {
  item?: ApiTrack | null
}

type Page<TItem> = {
  items?: TItem[] | null
  total?: number | null
}

const toPlaylistTrack = (track: ApiTrack | null | undefined): PlaylistTrack | undefined => {
  // Removed tracks come back as null, and local files cannot be started over
  // the Web API, so neither can be offered as a jump target.
  if (!track?.uri || track.uri.startsWith('spotify:local:')) {
    return undefined
  }

  return {
    uri: track.uri,
    name: track.name ?? 'Unknown track',
    artistNames: track.artists?.map((artist) => artist.name) ?? [],
    durationMs: track.duration_ms ?? 0,
  }
}

const collectPage = <TItem>(
  page: Page<TItem>,
  toTrack: (item: TItem) => PlaylistTrack | undefined,
  into: PlaylistTrack[],
): void => {
  for (const item of page.items ?? []) {
    const track = toTrack(item)

    if (track) {
      into.push(track)
    }
  }
}

/**
 * Reads every page of a track listing. The first page reports the total, so
 * the remaining offsets are known up front and can be fetched in batches
 * rather than one round trip at a time. Callers that already hold the first
 * page — an album response embeds it — pass it in rather than asking twice.
 */
const fetchAllTracks = async <TItem>(
  accessToken: string,
  buildPath: (offset: number) => string,
  toTrack: (item: TItem) => PlaylistTrack | undefined,
  embeddedFirstPage?: Page<TItem>,
): Promise<PlaylistTrack[]> => {
  const firstPage =
    embeddedFirstPage ?? (await request<Page<TItem>>(accessToken, buildPath(0)))
  const total = firstPage.total ?? firstPage.items?.length ?? 0
  const tracks: PlaylistTrack[] = []
  collectPage(firstPage, toTrack, tracks)

  const offsets: number[] = []
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    offsets.push(offset)
  }

  for (let index = 0; index < offsets.length; index += PAGE_BATCH_SIZE) {
    const batch = offsets.slice(index, index + PAGE_BATCH_SIZE)
    const batchPages = await Promise.all(
      batch.map((offset) => request<Page<TItem>>(accessToken, buildPath(offset))),
    )

    for (const page of batchPages) {
      collectPage(page, toTrack, tracks)
    }
  }

  return tracks
}

const fetchPlaylistContext = async (accessToken: string, playlistId: string): Promise<Playlist> => {
  const [details, tracks] = await Promise.all([
    request<{ name?: string | null }>(accessToken, `/playlists/${playlistId}?fields=name`),
    // /tracks was removed for development-mode apps in March 2026; /items is
    // its replacement, and answers 403 rather than 404 when it isn't allowed.
    fetchAllTracks<ApiPlaylistItem>(
      accessToken,
      (offset) =>
        `/playlists/${playlistId}/items?limit=${PAGE_SIZE}&offset=${offset}` +
        '&fields=total,items(item(uri,name,duration_ms,artists(name)))',
      (entry) => toPlaylistTrack(entry.item),
    ),
  ])

  return { name: details.name ?? 'Playlist', tracks }
}

const fetchAlbumContext = async (accessToken: string, albumId: string): Promise<Playlist> => {
  // The album object carries its first page of tracks, so asking the tracks
  // endpoint for offset 0 as well would fetch the same 50 items twice.
  const album = await request<{ name?: string | null; tracks?: Page<ApiTrack> | null }>(
    accessToken,
    `/albums/${albumId}`,
  )

  const tracks = await fetchAllTracks<ApiTrack>(
    accessToken,
    (offset) => `/albums/${albumId}/tracks?limit=${PAGE_SIZE}&offset=${offset}`,
    toPlaylistTrack,
    album.tracks ?? undefined,
  )

  return { name: album.name ?? 'Album', tracks }
}

export const fetchContextPlaylist = async (
  accessToken: string,
  context: SpotifyContext,
): Promise<Playlist> => {
  if (context.type === 'album') {
    return fetchAlbumContext(accessToken, context.id)
  }

  return fetchPlaylistContext(accessToken, context.id)
}

/** Targets one device, or whichever device is active when left undefined. */
const deviceQuery = (deviceId: string | undefined): string =>
  deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''

type PlayTrackInContextParams = {
  accessToken: string
  deviceId?: string
  contextUri: string
  trackUri: string
}

/**
 * Jumps to a track while keeping the surrounding context, so the rest of the
 * playlist stays queued up behind it.
 */
export const playTrackInContext = async ({
  accessToken,
  deviceId,
  contextUri,
  trackUri,
}: PlayTrackInContextParams): Promise<void> => {
  await request(accessToken, `/me/player/play${deviceQuery(deviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: contextUri, offset: { uri: trackUri } }),
  })
}

export type ApiPlaybackState = {
  is_playing?: boolean | null
  progress_ms?: number | null
  context?: { uri?: string | null } | null
  device?: SpotifyDevice | null
  item?: ApiTrack | null
}

export type SpotifyDevice = {
  id?: string | null
  name?: string | null
  type?: string | null
  is_active?: boolean | null
}

/** Undefined when Spotify answers 204, meaning nothing is playing anywhere. */
export const fetchPlaybackState = (
  accessToken: string,
): Promise<ApiPlaybackState | undefined> =>
  request<ApiPlaybackState | undefined>(accessToken, '/me/player')

export const fetchDevices = async (accessToken: string): Promise<SpotifyDevice[]> => {
  const response = await request<{ devices?: SpotifyDevice[] | null }>(
    accessToken,
    '/me/player/devices',
  )

  return response.devices ?? []
}

export const resumePlayback = (accessToken: string): Promise<void> =>
  request(accessToken, '/me/player/play', { method: 'PUT' })

export const pausePlayback = (accessToken: string): Promise<void> =>
  request(accessToken, '/me/player/pause', { method: 'PUT' })

export const skipToNext = (accessToken: string): Promise<void> =>
  request(accessToken, '/me/player/next', { method: 'POST' })

export const skipToPrevious = (accessToken: string): Promise<void> =>
  request(accessToken, '/me/player/previous', { method: 'POST' })

export const seekToPosition = (accessToken: string, positionMs: number): Promise<void> =>
  request(accessToken, `/me/player/seek?position_ms=${Math.round(positionMs)}`, {
    method: 'PUT',
  })

/** Moves playback to another device, keeping whatever is playing. */
export const transferPlayback = (accessToken: string, deviceId: string): Promise<void> =>
  request(accessToken, '/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })
