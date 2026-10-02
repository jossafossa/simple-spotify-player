const UNAVAILABLE_KEY = 'spotify-player:spotify-tempo-unavailable'

export const readSpotifyTempoUnavailable = (): boolean => {
  try {
    return localStorage.getItem(UNAVAILABLE_KEY) === 'true'
  } catch {
    return false
  }
}

export const saveSpotifyTempoUnavailable = (): void => {
  try {
    localStorage.setItem(UNAVAILABLE_KEY, 'true')
  } catch {
    // Not remembering it only means asking Spotify once more next time.
  }
}
