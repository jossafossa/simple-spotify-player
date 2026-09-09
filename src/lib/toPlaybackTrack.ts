import type { PlaybackTrack } from './types'

/**
 * The shape both of Spotify's track payloads share: the playback SDK's
 * `Spotify.Track` and the Web API's track object both satisfy it, so one
 * mapper serves both and they cannot drift apart on fallbacks.
 */
export type TrackSource = {
  id?: string | null
  uri?: string | null
  name?: string | null
  artists?: { name: string }[] | null
  album?: { name?: string | null; images?: { url: string }[] | null } | null
}

export const toPlaybackTrack = (source: TrackSource, durationMs: number): PlaybackTrack => ({
  id: source.id ?? '',
  uri: source.uri ?? '',
  name: source.name ?? 'Unknown track',
  artistNames: source.artists?.map((artist) => artist.name) ?? [],
  albumName: source.album?.name ?? '',
  albumImageUrl: source.album?.images?.[0]?.url,
  durationMs,
})
