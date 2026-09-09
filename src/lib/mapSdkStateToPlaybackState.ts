import { toPlaybackTrack } from './toPlaybackTrack'
import type { PlaybackState } from './types'

export const mapSdkStateToPlaybackState = (
  state: Spotify.PlaybackState,
): PlaybackState => ({
  track: toPlaybackTrack(state.track_window.current_track, state.duration),
  contextUri: state.context?.uri ?? undefined,
  positionMs: state.position,
  isPaused: state.paused,
})
