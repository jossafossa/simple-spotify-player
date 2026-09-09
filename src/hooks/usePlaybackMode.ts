import { useCallback, useEffect, useState } from 'react'
import {
  detectWidevineSupport,
  resolveDefaultPlaybackMode,
  type PlaybackMode,
} from '~/lib/playbackMode'
import {
  readLocalPlaybackFailed,
  readStoredPlaybackMode,
  saveLocalPlaybackFailed,
  saveStoredPlaybackMode,
} from '~/lib/playbackModeStorage'

export type UsePlaybackModeResult = {
  /** Undefined only while Widevine support is still being detected. */
  mode: PlaybackMode | undefined
  setMode: (mode: PlaybackMode) => void
  /** Records that playing in the page stalled, moving this device's default. */
  reportLocalPlaybackFailure: () => void
}

export const usePlaybackMode = (): UsePlaybackModeResult => {
  const [storedMode, setStoredMode] = useState(readStoredPlaybackMode)
  const [detectedMode, setDetectedMode] = useState<PlaybackMode>()

  useEffect(() => {
    // An explicit choice wins, so detection is only worth running without one.
    if (storedMode) {
      return
    }

    let isCancelled = false

    detectWidevineSupport().then((isWidevineSupported) => {
      if (!isCancelled) {
        setDetectedMode(
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
  }, [storedMode])

  const setMode = useCallback((mode: PlaybackMode) => {
    saveStoredPlaybackMode(mode)
    setStoredMode(mode)
  }, [])

  const reportLocalPlaybackFailure = useCallback(() => {
    saveLocalPlaybackFailed()
  }, [])

  return { mode: storedMode ?? detectedMode, setMode, reportLocalPlaybackFailure }
}
