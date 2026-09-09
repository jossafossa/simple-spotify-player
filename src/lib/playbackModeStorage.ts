import type { PlaybackMode } from './playbackMode'

const MODE_KEY = 'spotify-player:playback-mode'
const LOCAL_CAPABILITY_KEY = 'spotify-player:local-playback-capable'

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
 * What happened last time this browser asked Spotify for a DRM licence, which
 * is how an unlicensed Widevine build gives itself away. Recorded on refusal
 * *and* on success, so a browser that once failed is not written off for good.
 * It only moves the default; an explicit choice still wins.
 */
export const readLocalPlaybackFailed = (): boolean => {
  try {
    return localStorage.getItem(LOCAL_CAPABILITY_KEY) === 'false'
  } catch {
    return false
  }
}

export const saveLocalPlaybackCapability = (isPlayable: boolean): void => {
  try {
    localStorage.setItem(LOCAL_CAPABILITY_KEY, String(isPlayable))
  } catch {
    // Not remembering it only means working it out again next time.
  }
}
