import { useCallback, useEffect, useState } from 'react'
import {
  detectWidevineSupport,
  resolveDefaultPlaybackMode,
  type PlaybackMode,
} from '~/lib/playbackMode'
import {
  readLocalPlaybackFailed,
  readStoredPlaybackMode,
  saveLocalPlaybackCapability,
  saveStoredPlaybackMode,
} from '~/lib/playbackModeStorage'

export type UsePlaybackModeResult = {
  /** Undefined only while Widevine support is still being detected. */
  mode: PlaybackMode | undefined
  setMode: (mode: PlaybackMode) => void
  /** Records that playing in the page failed, moving this device's default. */
  reportLocalPlaybackFailure: () => void
}

export const usePlaybackMode = (): UsePlaybackModeResult => {
  const [mode, setResolvedMode] = useState(readStoredPlaybackMode)

  useEffect(() => {
    // An explicit choice is already in hand, so there is nothing to detect.
    if (mode) {
      return
    }

    let isCancelled = false

    detectWidevineSupport().then((isWidevineSupported) => {
      if (!isCancelled) {
        setResolvedMode(
          resolveDefaultPlaybackMode({
            isWidevineSupported,
            hasLocalPlaybackFailed: readLocalPlaybackFailed(),
          }),
        )
      }
    })

    return () => {
      isCancelled = true
    }
  }, [mode])

  const setMode = useCallback((nextMode: PlaybackMode) => {
    saveStoredPlaybackMode(nextMode)
    setResolvedMode(nextMode)
  }, [])

  const reportLocalPlaybackFailure = useCallback(() => {
    saveLocalPlaybackCapability(false)
  }, [])

  return { mode, setMode, reportLocalPlaybackFailure }
}
