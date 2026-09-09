import { useCallback, useEffect, useRef, useState } from 'react'
import { mapApiStateToPlaybackState } from '~/lib/mapApiStateToPlaybackState'
import {
  fetchDevices,
  fetchPlaybackState,
  pausePlayback,
  playTrackInContext,
  resumePlayback,
  seekToPosition,
  skipToNext,
  skipToPrevious,
  transferPlayback,
  type SpotifyDevice,
} from '~/lib/spotifyApi'
import type { PlaybackState } from '~/lib/types'

export type RemotePlayerStatus = 'idle' | 'connecting' | 'ready' | 'no-device' | 'error'

export type RemoteDevice = {
  id: string
  name: string
  isActive: boolean
}

export type UseRemotePlayerResult = {
  status: RemotePlayerStatus
  playbackState: PlaybackState | undefined
  togglePlay: () => void
  nextTrack: () => void
  previousTrack: () => void
  seek: (positionMs: number) => void
  playTrack: (contextUri: string, trackUri: string) => void
  devices: RemoteDevice[]
  activeDeviceName: string | undefined
  selectDevice: (deviceId: string) => void
}

/** Nothing pushes state when controlling another device, so it is polled. */
const POLL_INTERVAL_MS = 3_000
/** Spotify needs a moment to apply a command before it reports the result. */
const COMMAND_SETTLE_MS = 400

const toRemoteDevice = (device: SpotifyDevice): RemoteDevice | undefined =>
  device.id ? { id: device.id, name: device.name ?? 'Unknown device', isActive: !!device.is_active } : undefined

export const useRemotePlayer = (accessToken: string | undefined): UseRemotePlayerResult => {
  const [prevAccessToken, setPrevAccessToken] = useState(accessToken)
  const [status, setStatus] = useState<Exclude<RemotePlayerStatus, 'idle'>>('connecting')
  const [playbackState, setPlaybackState] = useState<PlaybackState>()
  const [devices, setDevices] = useState<RemoteDevice[]>([])
  const [activeDeviceName, setActiveDeviceName] = useState<string>()
  const refreshRef = useRef<(() => void) | undefined>(undefined)

  if (accessToken !== prevAccessToken) {
    setPrevAccessToken(accessToken)
    setStatus('connecting')
    setPlaybackState(undefined)
    setDevices([])
    setActiveDeviceName(undefined)
  }

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false

    const refresh = () => {
      Promise.all([fetchPlaybackState(accessToken), fetchDevices(accessToken)])
        .then(([state, deviceList]) => {
          if (isCancelled) {
            return
          }

          const remoteDevices = deviceList
            .map(toRemoteDevice)
            .filter((device): device is RemoteDevice => !!device)

          setDevices(remoteDevices)
          setPlaybackState(mapApiStateToPlaybackState(state))
          setActiveDeviceName(state?.device?.name ?? undefined)
          // A device has to be awake and selected before it can be driven.
          setStatus(state?.device?.id ? 'ready' : 'no-device')
        })
        .catch((error: unknown) => {
          if (!isCancelled) {
            console.error('Could not read remote playback state', error)
            setStatus('error')
          }
        })
    }

    refreshRef.current = refresh
    refresh()
    const intervalId = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
      refreshRef.current = undefined
    }
  }, [accessToken])

  /** Runs a command, then re-reads state so the UI follows the real device. */
  const runCommand = useCallback(
    (command: (token: string) => Promise<void>) => {
      if (!accessToken) {
        return
      }

      command(accessToken)
        .then(() => {
          setTimeout(() => refreshRef.current?.(), COMMAND_SETTLE_MS)
        })
        .catch((error: unknown) => {
          console.error('Remote playback command failed', error)
          refreshRef.current?.()
        })
    },
    [accessToken],
  )

  const isPaused = playbackState?.isPaused ?? true

  const togglePlay = useCallback(() => {
    runCommand((token) => (isPaused ? resumePlayback(token) : pausePlayback(token)))
    // Reflect the press immediately; the next poll corrects it if it failed.
    setPlaybackState((current) => (current ? { ...current, isPaused: !current.isPaused } : current))
  }, [isPaused, runCommand])

  const nextTrack = useCallback(() => runCommand(skipToNext), [runCommand])
  const previousTrack = useCallback(() => runCommand(skipToPrevious), [runCommand])

  const seek = useCallback(
    (positionMs: number) => {
      runCommand((token) => seekToPosition(token, positionMs))
      setPlaybackState((current) => (current ? { ...current, positionMs } : current))
    },
    [runCommand],
  )

  const playTrack = useCallback(
    (contextUri: string, trackUri: string) => {
      runCommand((token) => playTrackInContext({ accessToken: token, contextUri, trackUri }))
    },
    [runCommand],
  )

  const selectDevice = useCallback(
    (deviceId: string) => {
      runCommand((token) => transferPlayback(token, deviceId))
    },
    [runCommand],
  )

  return {
    status: accessToken ? status : 'idle',
    playbackState,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    playTrack,
    devices,
    activeDeviceName,
    selectDevice,
  }
}
