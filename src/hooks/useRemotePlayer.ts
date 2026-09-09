import { useCallback, useEffect, useState } from 'react'
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
import type { PlaybackState, PlayerControls, RemoteDevice } from '~/lib/types'

export type RemotePlayerStatus = 'idle' | 'connecting' | 'ready' | 'no-device' | 'error'

export type { RemoteDevice }

export type UseRemotePlayerResult = PlayerControls & {
  status: RemotePlayerStatus
  devices: RemoteDevice[]
  activeDeviceName: string | undefined
  selectDevice: (deviceId: string) => void
}

/** Nothing pushes state when controlling another device, so it is polled. */
const POLL_INTERVAL_MS = 3_000
/**
 * Devices wake and sleep on the order of minutes, so polling them as often as
 * the playback position would double the request volume for nothing.
 */
const DEVICE_POLL_INTERVAL_MS = 20_000
/** Spotify needs a moment to apply a command before it reports the result. */
const COMMAND_SETTLE_MS = 400

const toRemoteDevice = (device: SpotifyDevice): RemoteDevice[] =>
  device.id
    ? [{ id: device.id, name: device.name ?? 'Unknown device', isActive: !!device.is_active }]
    : []

const isSameTrack = (a: PlaybackState | undefined, b: PlaybackState) =>
  a?.track.uri === b.track.uri &&
  a?.positionMs === b.positionMs &&
  a?.isPaused === b.isPaused &&
  a?.contextUri === b.contextUri

const isSameDevices = (a: RemoteDevice[], b: RemoteDevice[]) =>
  a.length === b.length &&
  a.every((device, index) => {
    const other = b[index]
    return (
      device.id === other?.id &&
      device.name === other.name &&
      device.isActive === other.isActive
    )
  })

export const useRemotePlayer = (accessToken: string | undefined): UseRemotePlayerResult => {
  const [prevAccessToken, setPrevAccessToken] = useState(accessToken)
  const [status, setStatus] = useState<Exclude<RemotePlayerStatus, 'idle'>>('connecting')
  const [playbackState, setPlaybackState] = useState<PlaybackState>()
  const [devices, setDevices] = useState<RemoteDevice[]>([])
  const [activeDeviceName, setActiveDeviceName] = useState<string>()
  // Bumped to re-run the poll effect, which is also what re-arms its timer —
  // so a refresh after a command replaces the next tick instead of adding one.
  const [refreshKey, setRefreshKey] = useState(0)

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
      fetchPlaybackState(accessToken)
        .then((state) => {
          if (isCancelled) {
            return
          }

          const current = mapApiStateToPlaybackState(state)
          // Reusing the previous object when nothing moved keeps React from
          // re-rendering, and keeps the progress bar's interval alive.
          setPlaybackState((previous) =>
            current && isSameTrack(previous, current) ? previous : current,
          )
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

    refresh()
    const intervalId = setInterval(refresh, POLL_INTERVAL_MS)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [accessToken, refreshKey])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false

    const refreshDevices = () => {
      fetchDevices(accessToken)
        .then((deviceList) => {
          if (isCancelled) {
            return
          }

          const next = deviceList.flatMap(toRemoteDevice)
          setDevices((previous) => (isSameDevices(previous, next) ? previous : next))
        })
        .catch((error: unknown) => {
          if (!isCancelled) {
            console.error('Could not list Spotify devices', error)
          }
        })
    }

    refreshDevices()
    const intervalId = setInterval(refreshDevices, DEVICE_POLL_INTERVAL_MS)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [accessToken, refreshKey])

  /** Runs a command, then re-reads state so the UI follows the real device. */
  const runCommand = useCallback(
    (command: (token: string) => Promise<void>) => {
      if (!accessToken) {
        return
      }

      const scheduleRefresh = (delayMs: number) => {
        setTimeout(() => setRefreshKey((key) => key + 1), delayMs)
      }

      command(accessToken)
        .then(() => scheduleRefresh(COMMAND_SETTLE_MS))
        .catch((error: unknown) => {
          console.error('Remote playback command failed', error)
          scheduleRefresh(0)
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
