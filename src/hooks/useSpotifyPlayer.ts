import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSpotifyPlaybackSdk } from '~/lib/loadSpotifyPlaybackSdk'
import { mapSdkStateToPlaybackState } from '~/lib/mapSdkStateToPlaybackState'
import { playTrackInContext, transferPlayback } from '~/lib/spotifyApi'
import { watchWidevineLicense } from '~/lib/widevineLicense'
import { saveLocalPlaybackCapability } from '~/lib/playbackModeStorage'
import type { PlaybackState, PlayerControls } from '~/lib/types'

export type SpotifyPlayerStatus = 'idle' | 'connecting' | 'ready' | 'offline' | 'error'

export type UseSpotifyPlayerResult = PlayerControls & {
  status: SpotifyPlayerStatus
  /** Moves the account's playback onto this browser's SDK device. */
  claimPlayback: () => void
  /** What the SDK last refused to play, if anything. */
  playbackErrorMessage: string | undefined
  /**
   * True when Spotify refused this browser a DRM licence, which stops playback
   * a few seconds in without the SDK reporting anything.
   */
  isLicenseRefused: boolean
}

const PLAYER_NAME = 'Spotify Player (web)'

export const useSpotifyPlayer = (accessToken: string | undefined): UseSpotifyPlayerResult => {
  const [prevAccessToken, setPrevAccessToken] = useState(accessToken)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ready' | 'offline' | 'error'>(
    'connecting',
  )
  const [playbackState, setPlaybackState] = useState<PlaybackState>()
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState<string>()
  const [isLicenseRefused, setIsLicenseRefused] = useState(false)
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
    setIsLicenseRefused(false)
  }

  const status: SpotifyPlayerStatus = !accessToken ? 'idle' : connectionStatus

  /** Unlocks audio playback if a gesture hasn't already done so. */
  const activate = useCallback(() => {
    if (isActivatedRef.current) {
      return
    }

    isActivatedRef.current = true
    void playerRef.current?.activateElement()
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false
    let detachActivation: (() => void) | undefined

    // Remembered either way, so a browser that once failed can recover and a
    // working one is not re-probed from scratch.
    const unwatchLicense = watchWidevineLicense((isGranted) => {
      saveLocalPlaybackCapability(isGranted)

      if (!isCancelled) {
        setIsLicenseRefused(!isGranted)
      }
    })

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

    })

    return () => {
      isCancelled = true
      unwatchLicense()
      detachActivation?.()
      playerRef.current?.disconnect()
      playerRef.current = undefined
      deviceIdRef.current = undefined
      isActivatedRef.current = false
    }
  }, [accessToken, activate])

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

  /**
   * Takes playback over from whatever device currently holds it. Only ever
   * called from a user gesture, because the browser will not let the SDK's
   * audio element start without one.
   */
  const claimPlayback = useCallback(() => {
    const deviceId = deviceIdRef.current

    if (!accessToken || !deviceId) {
      return
    }

    activate()
    transferPlayback(accessToken, deviceId).catch((error: unknown) => {
      // Spotify refuses the transfer when the account has nothing to resume.
      console.error('Could not move playback to this browser', error)
    })
  }, [accessToken, activate])

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
    claimPlayback,
    playbackErrorMessage,
    isLicenseRefused,
  }
}
