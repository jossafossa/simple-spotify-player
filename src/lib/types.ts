export type PlaybackTrack = {
  id: string
  uri: string
  name: string
  artistNames: string[]
  albumName: string
  albumImageUrl: string | undefined
  durationMs: number
}

export type PlaybackState = {
  track: PlaybackTrack
  /** What the tracks are being played from, e.g. `spotify:playlist:37i9…`. */
  contextUri: string | undefined
  positionMs: number
  isPaused: boolean
}

export type PlaylistTrack = {
  uri: string
  name: string
  artistNames: string[]
  durationMs: number
}

export type Playlist = {
  name: string
  tracks: PlaylistTrack[]
}

/** A Spotify device that remote playback can be driven from or moved to. */
export type RemoteDevice = {
  id: string
  name: string
  isActive: boolean
}

/** How far the tracks of the current playback context have got. */
export type PlaylistStatus =
  | 'empty'
  | 'unsupported'
  | 'loading'
  | 'ready'
  | 'expired'
  | 'forbidden'
  | 'inaccessible'
  | 'error'

/**
 * The controls every playback mode offers, however it reaches Spotify. Each
 * mode's hook adds its own extras on top, so this stays the one declaration of
 * the shared surface.
 */
export type PlayerControls = {
  playbackState: PlaybackState | undefined
  togglePlay: () => void
  nextTrack: () => void
  previousTrack: () => void
  seek: (positionMs: number) => void
  playTrack: (contextUri: string, trackUri: string) => void
}
