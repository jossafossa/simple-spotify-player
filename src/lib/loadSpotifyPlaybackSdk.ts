let sdkLoadPromise: Promise<void> | undefined

/**
 * The SDK script calls a single global callback once, so a module-level
 * promise makes repeated calls (e.g. StrictMode double-mount) idempotent.
 */
export const loadSpotifyPlaybackSdk = (): Promise<void> => {
  if (window.Spotify) {
    return Promise.resolve()
  }

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve()

      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.body.appendChild(script)
    })
  }

  return sdkLoadPromise
}
