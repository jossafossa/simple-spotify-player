import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSpotifyPlaybackSdk } from '~/lib/loadSpotifyPlaybackSdk'
import { mapSdkStateToPlaybackState } from '~/lib/mapSdkStateToPlaybackState'
import type { PlaybackState } from '~/lib/types'

export type SpotifyPlayerStatus = 'idle' | 'connecting' | 'ready' | 'error'

export type UseSpotifyPlayerResult = {
  status: SpotifyPlayerStatus
  playbackState: PlaybackState | undefined
  togglePlay: () => void
  nextTrack: () => void
  previousTrack: () => void
  seek: (positionMs: number) => void
}

const PLAYER_NAME = 'Spotify Player (web)'

export const useSpotifyPlayer = (accessToken: string | undefined): UseSpotifyPlayerResult => {
  const [prevAccessToken, setPrevAccessToken] = useState(accessToken)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ready' | 'error'>(
    'connecting',
  )
  const [playbackState, setPlaybackState] = useState<PlaybackState>()
  const playerRef = useRef<Spotify.Player | undefined>(undefined)

  // Reset connection state during render (not in an effect) when the token
  // itself changes, so the stale previous track/status never flashes.
  if (accessToken !== prevAccessToken) {
    setPrevAccessToken(accessToken)
    setConnectionStatus('connecting')
    setPlaybackState(undefined)
  }

  const status: SpotifyPlayerStatus = !accessToken ? 'idle' : connectionStatus

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false

    loadSpotifyPlaybackSdk().then(() => {
      if (isCancelled) {
        return
      }

      const player = new window.Spotify.Player({
        name: PLAYER_NAME,
        getOAuthToken: (callback) => callback(accessToken),
        volume: 0.5,
      })

      const handleError = () => {
        if (!isCancelled) {
          setConnectionStatus('error')
        }
      }

      player.addListener('ready', () => {
        if (!isCancelled) {
          setConnectionStatus('ready')
        }
      })
      player.addListener('not_ready', handleError)
      player.addListener('initialization_error', handleError)
      player.addListener('authentication_error', handleError)
      player.addListener('account_error', handleError)
      player.addListener('player_state_changed', (state) => {
        if (!isCancelled && state) {
          setPlaybackState(mapSdkStateToPlaybackState(state))
        }
      })

      player.connect()
      playerRef.current = player
    })

    return () => {
      isCancelled = true
      playerRef.current?.disconnect()
      playerRef.current = undefined
    }
  }, [accessToken])

  const togglePlay = useCallback(() => {
    void playerRef.current?.togglePlay()
  }, [])

  const nextTrack = useCallback(() => {
    void playerRef.current?.nextTrack()
  }, [])

  const previousTrack = useCallback(() => {
    void playerRef.current?.previousTrack()
  }, [])

  const seek = useCallback((positionMs: number) => {
    void playerRef.current?.seek(positionMs)
  }, [])

  return { status, playbackState, togglePlay, nextTrack, previousTrack, seek }
}
