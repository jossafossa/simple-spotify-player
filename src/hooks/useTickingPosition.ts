import { useEffect, useState } from 'react'
import type { PlaybackState } from '~/lib/types'

const TICK_INTERVAL_MS = 250

/**
 * The SDK only reports position when playback state changes (play, pause,
 * seek, track change), not continuously — this interpolates a smoothly
 * advancing position between those events for the progress bar.
 */
export const useTickingPosition = (playbackState: PlaybackState | undefined): number => {
  const [positionMs, setPositionMs] = useState(playbackState?.positionMs ?? 0)

  useEffect(() => {
    // Resetting on every playbackState identity change (not just render-phase
    // comparison) is required here: callers aren't guaranteed to memoize the
    // object, and a render-phase reset would loop whenever they don't.
    setPositionMs(playbackState?.positionMs ?? 0)

    if (!playbackState || playbackState.isPaused) {
      return
    }

    const startTime = Date.now()
    const basePosition = playbackState.positionMs

    const intervalId = setInterval(() => {
      setPositionMs(Math.min(basePosition + (Date.now() - startTime), playbackState.track.durationMs))
    }, TICK_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [playbackState])

  return positionMs
}
