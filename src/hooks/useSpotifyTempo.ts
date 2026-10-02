import { useState } from 'react'
import { SpotifyRequestError } from '~/lib/spotifyApi'
import { readSpotifyTempoUnavailable, saveSpotifyTempoUnavailable } from '~/lib/spotifyTempoStorage'

export type SpotifyTempoStatus = 'idle' | 'loading' | 'missing' | 'unavailable' | 'error'

export type UseSpotifyTempoResult = {
  status: SpotifyTempoStatus
  /** Asks Spotify for the song's tempo and hands it on when there is one. */
  request: () => void
}

/**
 * The tempo Spotify measured for a song, on request. Spotify refuses it to
 * apps registered since late 2024; once refused, it is not asked again.
 */
export const useSpotifyTempo = (
  loadBpm: (() => Promise<number | undefined>) | undefined,
  onBpm: (bpm: number) => void,
): UseSpotifyTempoResult => {
  const [status, setStatus] = useState<SpotifyTempoStatus>(() =>
    readSpotifyTempoUnavailable() ? 'unavailable' : 'idle',
  )

  const request = () => {
    if (!loadBpm || status === 'loading' || status === 'unavailable') {
      return
    }

    setStatus('loading')
    loadBpm()
      .then((bpm) => {
        if (bpm === undefined) {
          setStatus('missing')
          return
        }

        setStatus('idle')
        onBpm(bpm)
      })
      .catch((error: unknown) => {
        if (error instanceof SpotifyRequestError && error.status === 403) {
          saveSpotifyTempoUnavailable()
          setStatus('unavailable')
          return
        }

        console.error('Could not read the tempo from Spotify', error)
        setStatus('error')
      })
  }

  return { status, request }
}
