export type PlaybackMode = 'local' | 'remote'

/** A codec every Spotify stream uses, enough to ask whether Widevine exists. */
const WIDEVINE_CONFIG: MediaKeySystemConfiguration[] = [
  {
    initDataTypes: ['cenc'],
    audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }],
  },
]

/**
 * Spotify streams protected content through Widevine, so a browser without it
 * can never play in the page and is better off controlling another device.
 *
 * Note this only proves the browser *has* a Widevine CDM, not that Spotify
 * will issue it a licence — Firefox forks ship the plugin unlicensed, and only
 * a stalled stream reveals that.
 */
export const detectWidevineSupport = async (): Promise<boolean> => {
  if (typeof navigator.requestMediaKeySystemAccess !== 'function') {
    return false
  }

  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', WIDEVINE_CONFIG)
    return true
  } catch {
    return false
  }
}

type ResolveDefaultModeParams = {
  isWidevineSupported: boolean
  hasLocalPlaybackFailed: boolean
}

export const resolveDefaultPlaybackMode = ({
  isWidevineSupported,
  hasLocalPlaybackFailed,
}: ResolveDefaultModeParams): PlaybackMode =>
  isWidevineSupported && !hasLocalPlaybackFailed ? 'local' : 'remote'
