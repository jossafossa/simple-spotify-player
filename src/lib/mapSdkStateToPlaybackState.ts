import type { PlaybackState } from './types'

export const mapSdkStateToPlaybackState = (
  state: Spotify.PlaybackState,
): PlaybackState => {
  const currentTrack = state.track_window.current_track

  return {
    track: {
      id: currentTrack.id ?? '',
      name: currentTrack.name,
      artistNames: currentTrack.artists.map((artist) => artist.name),
      albumName: currentTrack.album.name,
      albumImageUrl: currentTrack.album.images[0]?.url,
      durationMs: state.duration,
    },
    positionMs: state.position,
    isPaused: state.paused,
  }
}
