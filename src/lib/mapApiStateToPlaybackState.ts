import { toPlaybackTrack } from './toPlaybackTrack'
import type { ApiPlaybackState } from './spotifyApi'
import type { PlaybackState } from './types'

/**
 * The counterpart to mapSdkStateToPlaybackState for remote control, where
 * state is polled from the Web API rather than pushed by the playback SDK.
 * Undefined means Spotify reported nothing playable.
 */
export const mapApiStateToPlaybackState = (
  state: ApiPlaybackState | undefined,
): PlaybackState | undefined => {
  const item = state?.item

  if (!item?.uri) {
    return undefined
  }

  return {
    track: toPlaybackTrack(item, item.duration_ms ?? 0),
    contextUri: state?.context?.uri ?? undefined,
    positionMs: state?.progress_ms ?? 0,
    isPaused: !state?.is_playing,
  }
}
