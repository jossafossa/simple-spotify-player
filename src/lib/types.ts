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
