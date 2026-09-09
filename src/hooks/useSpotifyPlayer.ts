import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSpotifyPlaybackSdk } from '~/lib/loadSpotifyPlaybackSdk'
import { mapSdkStateToPlaybackState } from '~/lib/mapSdkStateToPlaybackState'
import { playTrackInContext } from '~/lib/spotifyApi'
import type { PlaybackState } from '~/lib/types'

export type SpotifyPlayerStatus = 'idle' | 'connecting' | 'ready' | 'offline' | 'error'

export type UseSpotifyPlayerResult = {
  status: SpotifyPlayerStatus
  playbackState: PlaybackState | undefined
  togglePlay: () => void
  nextTrack: () => void
  previousTrack: () => void
  seek: (positionMs: number) => void
  playTrack: (contextUri: string, trackUri: string) => void
  /** What the SDK last refused to play, if anything. */
  playbackErrorMessage: string | undefined
  /**
   * True when the SDK claims to be playing but the position is not moving.
   * A failed DRM licence fetch stalls exactly like this and reports nothing.
   */
  isStalled: boolean
}

const PLAYER_NAME = 'Spotify Player (web)'

/**
 * `player_state_changed` only fires on transitions, and stops arriving
 * altogether once the device drops out, so the real state is polled too.
 */
const STATE_SYNC_INTERVAL_MS = 5_000

export const useSpotifyPlayer = (accessToken: string | undefined): UseSpotifyPlayerResult => {
  const [prevAccessToken, setPrevAccessToken] = useState(accessToken)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ready' | 'offline' | 'error'>(
    'connecting',
  )
  const [playbackState, setPlaybackState] = useState<PlaybackState>()
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState<string>()
  const [isStalled, setIsStalled] = useState(false)
  const lastSyncRef = useRef<{ trackUri: string; positionMs: number } | undefined>(undefined)
  const playerRef = useRef<Spotify.Player | undefined>(undefined)
  const deviceIdRef = useRef<string | undefined>(undefined)
  const isActivatedRef = useRef(false)

  // Reset connection state during render (not in an effect) when the token
  // itself changes, so the stale previous track/status never flashes.
  if (accessToken !== prevAccessToken) {
    setPrevAccessToken(accessToken)
    setConnectionStatus('connecting')
    setPlaybackState(undefined)
    setPlaybackErrorMessage(undefined)
    setIsStalled(false)
  }

  const status: SpotifyPlayerStatus = !accessToken ? 'idle' : connectionStatus

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false
    let syncIntervalId: ReturnType<typeof setInterval> | undefined
    let detachActivation: (() => void) | undefined

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

      player.addListener('ready', ({ device_id }) => {
        if (!isCancelled) {
          deviceIdRef.current = device_id
          setConnectionStatus('ready')
        }
      })
      // The device going offline is recoverable — the SDK reconnects — so it
      // must not tear the whole player down the way a fatal error does.
      player.addListener('not_ready', () => {
        if (!isCancelled) {
          setConnectionStatus('offline')
        }
      })
      // Firefox fails here rather than at connect time when DRM playback is
      // switched off, which otherwise looks like silence with a ticking bar.
      player.addListener('playback_error', ({ message }) => {
        if (!isCancelled) {
          setPlaybackErrorMessage(message)
        }
      })
      player.addListener('initialization_error', handleError)
      player.addListener('authentication_error', handleError)
      player.addListener('account_error', handleError)
      player.addListener('player_state_changed', (state) => {
        if (!isCancelled && state) {
          setPlaybackState(mapSdkStateToPlaybackState(state))
          setPlaybackErrorMessage(undefined)
        }
      })

      player.connect()
      playerRef.current = player

      // Browsers block the SDK's audio element until the page has had a user
      // gesture; without this, playback dies a few seconds in and the device
      // stops answering commands while the progress bar ticks on regardless.
      const activateOnFirstGesture = () => {
        if (isActivatedRef.current) {
          return
        }

        isActivatedRef.current = true
        void player.activateElement()
      }

      document.addEventListener('pointerdown', activateOnFirstGesture)
      document.addEventListener('keydown', activateOnFirstGesture)
      detachActivation = () => {
        document.removeEventListener('pointerdown', activateOnFirstGesture)
        document.removeEventListener('keydown', activateOnFirstGesture)
      }

      syncIntervalId = setInterval(() => {
        player.getCurrentState().then((state) => {
          if (isCancelled || !state) {
            return
          }

          const current = mapSdkStateToPlaybackState(state)
          setPlaybackState(current)

          const previous = lastSyncRef.current
          lastSyncRef.current = {
            trackUri: current.track.uri,
            positionMs: current.positionMs,
          }

          // Only the same track running twice without advancing counts as a
          // stall; a track change legitimately rewinds the position to zero.
          if (current.isPaused || previous?.trackUri !== current.track.uri) {
            setIsStalled(false)
            return
          }

          setIsStalled(current.positionMs <= previous.positionMs)
        })
      }, STATE_SYNC_INTERVAL_MS)
    })

    return () => {
      isCancelled = true
      clearInterval(syncIntervalId)
      detachActivation?.()
      playerRef.current?.disconnect()
      playerRef.current = undefined
      deviceIdRef.current = undefined
      isActivatedRef.current = false
      lastSyncRef.current = undefined
    }
  }, [accessToken])

  /** Unlocks audio playback if a gesture hasn't already done so. */
  const activate = useCallback(() => {
    if (isActivatedRef.current) {
      return
    }

    isActivatedRef.current = true
    void playerRef.current?.activateElement()
  }, [])

  const togglePlay = useCallback(() => {
    activate()
    void playerRef.current?.togglePlay()
  }, [activate])

  const nextTrack = useCallback(() => {
    activate()
    void playerRef.current?.nextTrack()
  }, [activate])

  const previousTrack = useCallback(() => {
    activate()
    void playerRef.current?.previousTrack()
  }, [activate])

  const seek = useCallback((positionMs: number) => {
    void playerRef.current?.seek(positionMs)
  }, [])

  // Jumping to an arbitrary track is not something the playback SDK exposes,
  // so it goes over the Web API against this player's device.
  const playTrack = useCallback(
    (contextUri: string, trackUri: string) => {
      const deviceId = deviceIdRef.current

      if (!accessToken || !deviceId) {
        return
      }

      activate()
      void playTrackInContext({ accessToken, deviceId, contextUri, trackUri })
    },
    [accessToken, activate],
  )

  return {
    status,
    playbackState,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    playTrack,
    playbackErrorMessage,
    isStalled,
  }
}
