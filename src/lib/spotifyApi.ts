import type { Playlist, PlaylistTrack } from './types'

const API_BASE = 'https://api.spotify.com/v1'
/** Both listing endpoints cap a page at 50 items. */
const PLAYLIST_PAGE_SIZE = 50
const ALBUM_PAGE_SIZE = 50
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
  uri?: string | null
  name?: string | null
  duration_ms?: number | null
  artists?: { name: string }[] | null
}

/**
 * The February 2026 API renamed the playlist listing's `track` field to
 * `item`; both are accepted so a rollback either way keeps working.
 */
type ApiPlaylistItem = {
  item?: ApiTrack | null
  track?: ApiTrack | null
}

type Page<TItem> = {
  items: TItem[] | null
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

const collectTracks = <TItem>(
  items: (TItem[] | null | undefined)[],
  toTrack: (item: TItem) => PlaylistTrack | undefined,
): PlaylistTrack[] => {
  const tracks: PlaylistTrack[] = []

  for (const page of items) {
    for (const item of page ?? []) {
      const track = toTrack(item)

      if (track) {
        tracks.push(track)
      }
    }
  }

  return tracks
}

/**
 * Reads every page of a track listing. The first page reports the total, so
 * the remaining offsets are known up front and can be fetched in batches
 * rather than one round trip at a time.
 */
const fetchAllTracks = async <TItem>(
  accessToken: string,
  buildPath: (offset: number) => string,
  pageSize: number,
  toTrack: (item: TItem) => PlaylistTrack | undefined,
): Promise<PlaylistTrack[]> => {
  const firstPage = await request<Page<TItem>>(accessToken, buildPath(0))
  const total = firstPage.total ?? firstPage.items?.length ?? 0
  const pages: (TItem[] | null | undefined)[] = [firstPage.items]

  const offsets: number[] = []
  for (let offset = pageSize; offset < total; offset += pageSize) {
    offsets.push(offset)
  }

  for (let index = 0; index < offsets.length; index += PAGE_BATCH_SIZE) {
    const batch = offsets.slice(index, index + PAGE_BATCH_SIZE)
    const batchPages = await Promise.all(
      batch.map((offset) => request<Page<TItem>>(accessToken, buildPath(offset))),
    )

    pages.push(...batchPages.map((page) => page.items))
  }

  return collectTracks(pages, toTrack)
}

const fetchPlaylistContext = async (accessToken: string, playlistId: string): Promise<Playlist> => {
  const [details, tracks] = await Promise.all([
    request<{ name?: string | null }>(accessToken, `/playlists/${playlistId}?fields=name`),
    // /tracks was removed for development-mode apps in March 2026; /items is
    // its replacement, and answers 403 rather than 404 when it isn't allowed.
    fetchAllTracks<ApiPlaylistItem>(
      accessToken,
      (offset) =>
        `/playlists/${playlistId}/items?limit=${PLAYLIST_PAGE_SIZE}&offset=${offset}` +
        '&fields=total,items(item(uri,name,duration_ms,artists(name)))',
      PLAYLIST_PAGE_SIZE,
      (entry) => toPlaylistTrack(entry.item ?? entry.track),
    ),
  ])

  return { name: details.name ?? 'Playlist', tracks }
}

const fetchAlbumContext = async (accessToken: string, albumId: string): Promise<Playlist> => {
  const [details, tracks] = await Promise.all([
    request<{ name?: string | null }>(accessToken, `/albums/${albumId}`),
    fetchAllTracks<ApiTrack>(
      accessToken,
      (offset) => `/albums/${albumId}/tracks?limit=${ALBUM_PAGE_SIZE}&offset=${offset}`,
      ALBUM_PAGE_SIZE,
      toPlaylistTrack,
    ),
  ])

  return { name: details.name ?? 'Album', tracks }
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

type PlayTrackInContextParams = {
  accessToken: string
  deviceId: string
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
  await request(accessToken, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: contextUri, offset: { uri: trackUri } }),
  })
}
