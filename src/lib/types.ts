export type PlaybackTrack = {
  id: string
  name: string
  artistNames: string[]
  albumName: string
  albumImageUrl: string | undefined
  durationMs: number
}

export type PlaybackState = {
  track: PlaybackTrack
  positionMs: number
  isPaused: boolean
}
