import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpotifyPlayer } from './useSpotifyPlayer'

import { playTrackInContext } from '~/lib/spotifyApi'

vi.mock('~/lib/loadSpotifyPlaybackSdk', () => ({
  loadSpotifyPlaybackSdk: () => Promise.resolve(),
}))
vi.mock('~/lib/spotifyApi', () => ({
  playTrackInContext: vi.fn().mockResolvedValue(undefined),
}))

const mockedPlayTrackInContext = vi.mocked(playTrackInContext)

type Listener = (...args: unknown[]) => void

class FakeSpotifyPlayer {
  static instances: FakeSpotifyPlayer[] = []

  listeners = new Map<string, Listener[]>()
  connect = vi.fn().mockResolvedValue(true)
  disconnect = vi.fn()
  togglePlay = vi.fn().mockResolvedValue(undefined)
  nextTrack = vi.fn().mockResolvedValue(undefined)
  previousTrack = vi.fn().mockResolvedValue(undefined)
  seek = vi.fn().mockResolvedValue(undefined)
  activateElement = vi.fn().mockResolvedValue(undefined)
  getCurrentState = vi.fn().mockResolvedValue(null)

  options: Spotify.PlayerInit

  constructor(options: Spotify.PlayerInit) {
    this.options = options
    FakeSpotifyPlayer.instances.push(this)
  }

  addListener(event: string, callback: Listener) {
    const callbacks = this.listeners.get(event) ?? []
    callbacks.push(callback)
    this.listeners.set(event, callbacks)
  }

  emit(event: string, payload?: unknown) {
    for (const callback of this.listeners.get(event) ?? []) {
      callback(payload)
    }
  }
}

const buildSdkState = (
  overrides: { position?: number; paused?: boolean; uri?: string } = {},
): Spotify.PlaybackState =>
  ({
    duration: 100_000,
    paused: overrides.paused ?? false,
    position: overrides.position ?? 0,
    track_window: {
      current_track: {
        id: 'track-1',
        uri: overrides.uri ?? 'spotify:track:track-1',
        name: 'Song',
        artists: [{ name: 'Artist' }],
        album: { name: 'Album', images: [] },
      },
    },
  }) as unknown as Spotify.PlaybackState

describe('useSpotifyPlayer', () => {
  beforeEach(() => {
    FakeSpotifyPlayer.instances = []
    mockedPlayTrackInContext.mockClear()
    window.Spotify = { Player: FakeSpotifyPlayer } as unknown as typeof Spotify
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays idle without an access token', () => {
    const { result } = renderHook(() => useSpotifyPlayer(undefined))

    expect(result.current.status).toBe('idle')
    expect(FakeSpotifyPlayer.instances).toHaveLength(0)
  })

  it('connects and becomes ready when the SDK reports ready', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('ready', { device_id: 'device-1' })
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(player.connect).toHaveBeenCalledOnce()
  })

  it('exposes playback state from player_state_changed events', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('player_state_changed', buildSdkState())
    })

    await waitFor(() =>
      expect(result.current.playbackState?.track.name).toBe('Song'),
    )
  })

  it('reports the device as offline, not broken, when it drops out', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('ready', { device_id: 'device-1' })
      player.emit('not_ready', { device_id: 'device-1' })
    })

    await waitFor(() => expect(result.current.status).toBe('offline'))
  })

  it('unlocks the audio element on the first user gesture', async () => {
    renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      document.dispatchEvent(new Event('pointerdown'))
      document.dispatchEvent(new Event('pointerdown'))
    })

    expect(player.activateElement).toHaveBeenCalledOnce()
  })

  it('unlocks the audio element when a control is used before any gesture', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      result.current.togglePlay()
    })

    expect(player.activateElement).toHaveBeenCalledOnce()
  })

  it('surfaces a playback error without tearing the player down', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('ready', { device_id: 'device-1' })
      player.emit('playback_error', { message: 'Playback of protected content is not enabled.' })
    })

    await waitFor(() =>
      expect(result.current.playbackErrorMessage).toBe(
        'Playback of protected content is not enabled.',
      ),
    )
    expect(result.current.status).toBe('ready')
  })

  it('clears a playback error once playback reports state again', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('playback_error', { message: 'nope' })
    })
    await waitFor(() => expect(result.current.playbackErrorMessage).toBe('nope'))

    act(() => {
      player.emit('player_state_changed', buildSdkState())
    })

    await waitFor(() => expect(result.current.playbackErrorMessage).toBeUndefined())
  })

  it('flags a stall when the same track stops advancing', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await vi.waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!
    player.getCurrentState.mockResolvedValue(buildSdkState({ position: 10_000 }))

    // Two polls at the same position on the same track is the stall signal.
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(result.current.isStalled).toBe(true)
    vi.useRealTimers()
  })

  it('does not flag a stall while the position keeps advancing', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await vi.waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    player.getCurrentState.mockResolvedValue(buildSdkState({ position: 10_000 }))
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    player.getCurrentState.mockResolvedValue(buildSdkState({ position: 15_000 }))
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(result.current.isStalled).toBe(false)
    vi.useRealTimers()
  })

  it('does not mistake a track change for a stall', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await vi.waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    player.getCurrentState.mockResolvedValue(buildSdkState({ position: 90_000 }))
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    // The next track legitimately restarts the position at zero.
    player.getCurrentState.mockResolvedValue(
      buildSdkState({ position: 0, uri: 'spotify:track:track-2' }),
    )
    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(result.current.isStalled).toBe(false)
    vi.useRealTimers()
  })

  it('moves to error status on an authentication error', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('authentication_error', { message: 'bad token' })
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('delegates transport controls to the SDK player', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      result.current.togglePlay()
      result.current.nextTrack()
      result.current.previousTrack()
      result.current.seek(5_000)
    })

    expect(player.togglePlay).toHaveBeenCalledOnce()
    expect(player.nextTrack).toHaveBeenCalledOnce()
    expect(player.previousTrack).toHaveBeenCalledOnce()
    expect(player.seek).toHaveBeenCalledWith(5_000)
  })

  it('plays a chosen track on this device once it is ready', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    act(() => {
      player.emit('ready', { device_id: 'device-1' })
    })

    act(() => {
      result.current.playTrack('spotify:playlist:p1', 'spotify:track:7')
    })

    expect(mockedPlayTrackInContext).toHaveBeenCalledWith({
      accessToken: 'a-token',
      deviceId: 'device-1',
      contextUri: 'spotify:playlist:p1',
      trackUri: 'spotify:track:7',
    })
  })

  it('ignores a track jump before the device is ready', async () => {
    const { result } = renderHook(() => useSpotifyPlayer('a-token'))

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))

    act(() => {
      result.current.playTrack('spotify:playlist:p1', 'spotify:track:7')
    })

    expect(mockedPlayTrackInContext).not.toHaveBeenCalled()
  })

  it('disconnects the player when the token is cleared', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string | undefined }) => useSpotifyPlayer(token),
      { initialProps: { token: 'a-token' as string | undefined } },
    )

    await waitFor(() => expect(FakeSpotifyPlayer.instances).toHaveLength(1))
    const player = FakeSpotifyPlayer.instances[0]!

    rerender({ token: undefined })

    expect(player.disconnect).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('idle')
  })
})
