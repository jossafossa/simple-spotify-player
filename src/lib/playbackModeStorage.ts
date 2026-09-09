import type { PlaybackMode } from './playbackMode'

const MODE_KEY = 'spotify-player:playback-mode'
const LOCAL_FAILED_KEY = 'spotify-player:local-playback-failed'

const isPlaybackMode = (value: string | null): value is PlaybackMode =>
  value === 'local' || value === 'remote'

/** Undefined means the device has never been given an explicit choice. */
export const readStoredPlaybackMode = (): PlaybackMode | undefined => {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    return isPlaybackMode(stored) ? stored : undefined
  } catch {
    return undefined
  }
}

export const saveStoredPlaybackMode = (mode: PlaybackMode): void => {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // A browser refusing storage only costs the remembered mode.
  }
}

/**
 * Set when playing in the page stalled, which is how an unlicensed Widevine
 * build shows itself. It only moves the default; an explicit choice still wins.
 */
export const readLocalPlaybackFailed = (): boolean => {
  try {
    return localStorage.getItem(LOCAL_FAILED_KEY) === 'true'
  } catch {
    return false
  }
}

export const saveLocalPlaybackFailed = (): void => {
  try {
    localStorage.setItem(LOCAL_FAILED_KEY, 'true')
  } catch {
    // Not remembering the failure only means detecting it again next time.
  }
}
