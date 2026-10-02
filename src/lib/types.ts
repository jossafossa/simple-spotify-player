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
  isShuffled: boolean
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

/** One of the user's own or followed playlists, as listed in the picker. */
export type PlaylistSummary = {
  uri: string
  name: string
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
  toggleShuffle: () => void
  playTrack: (contextUri: string, trackUri: string) => void
  /** 0–100, or undefined when the device does not report or support volume. */
  volume: number | undefined
  setVolume: (volumePercent: number) => void
}

/** How a tab file is encoded. Only Guitar Pro files can be drawn and played. */
export type TabFormat = 'guitar-pro' | 'power-tab'

/** A tab file in the library. Its bytes are stored apart and loaded on demand. */
export type TabFile = {
  id: string
  /** Shown in lists; starts as the file name without its extension. */
  name: string
  fileName: string
  format: TabFormat
  sizeBytes: number
  addedAt: number
}

/** A song with tabs linked to it, kept with enough detail to list it offline. */
export type TabSong = {
  uri: string
  name: string
  artistNames: string[]
  tabIds: string[]
}

/** The bits of a track that linking a tab to it needs. */
export type SongRef = Pick<TabSong, 'uri' | 'name' | 'artistNames'>
