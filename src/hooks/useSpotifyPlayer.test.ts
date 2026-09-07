import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpotifyPlayer } from './useSpotifyPlayer'

vi.mock('~/lib/loadSpotifyPlaybackSdk', () => ({
  loadSpotifyPlaybackSdk: () => Promise.resolve(),
}))

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

const buildSdkState = (): Spotify.PlaybackState =>
  ({
    duration: 100_000,
    paused: false,
    position: 0,
    track_window: {
      current_track: {
        id: 'track-1',
        name: 'Song',
        artists: [{ name: 'Artist' }],
        album: { name: 'Album', images: [] },
      },
    },
  }) as unknown as Spotify.PlaybackState

describe('useSpotifyPlayer', () => {
  beforeEach(() => {
    FakeSpotifyPlayer.instances = []
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
