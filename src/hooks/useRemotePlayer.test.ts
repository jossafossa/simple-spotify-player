import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
} from '~/lib/spotifyApi'
import { useRemotePlayer } from './useRemotePlayer'

vi.mock('~/lib/spotifyApi', () => ({
  fetchPlaybackState: vi.fn(),
  fetchDevices: vi.fn(),
  resumePlayback: vi.fn(),
  pausePlayback: vi.fn(),
  skipToNext: vi.fn(),
  skipToPrevious: vi.fn(),
  seekToPosition: vi.fn(),
  transferPlayback: vi.fn(),
  playTrackInContext: vi.fn(),
}))

const mockedFetchPlaybackState = vi.mocked(fetchPlaybackState)
const mockedFetchDevices = vi.mocked(fetchDevices)

const apiState = {
  is_playing: true,
  progress_ms: 10_000,
  context: { uri: 'spotify:playlist:p1' },
  device: { id: 'device-1', name: 'Kitchen speaker', is_active: true },
  item: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Song',
    duration_ms: 100_000,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [] },
  },
}

describe('useRemotePlayer', () => {
  beforeEach(() => {
    vi.mocked(resumePlayback).mockResolvedValue(undefined)
    vi.mocked(pausePlayback).mockResolvedValue(undefined)
    vi.mocked(skipToNext).mockResolvedValue(undefined)
    vi.mocked(skipToPrevious).mockResolvedValue(undefined)
    vi.mocked(seekToPosition).mockResolvedValue(undefined)
    vi.mocked(transferPlayback).mockResolvedValue(undefined)
    vi.mocked(playTrackInContext).mockResolvedValue(undefined)
    mockedFetchPlaybackState.mockReset()
    mockedFetchDevices.mockReset()
    mockedFetchPlaybackState.mockResolvedValue(apiState)
    mockedFetchDevices.mockResolvedValue([
      { id: 'device-1', name: 'Kitchen speaker', is_active: true },
      { id: 'device-2', name: 'Phone', is_active: false },
    ])
  })

  it('stays idle without an access token', () => {
    const { result } = renderHook(() => useRemotePlayer(undefined))

    expect(result.current.status).toBe('idle')
    expect(mockedFetchPlaybackState).not.toHaveBeenCalled()
  })

  it('reads what the remote device is playing', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.playbackState?.track.name).toBe('Song')
    expect(result.current.playbackState?.contextUri).toBe('spotify:playlist:p1')
    expect(result.current.activeDeviceName).toBe('Kitchen speaker')
  })

  it('lists the devices that could be driven', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))

    await waitFor(() => expect(result.current.devices).toHaveLength(2))
    expect(result.current.devices[0]).toEqual({
      id: 'device-1',
      name: 'Kitchen speaker',
      isActive: true,
    })
  })

  it('drops devices Spotify reports without an id', async () => {
    mockedFetchDevices.mockResolvedValue([{ id: null, name: 'Restricted' }])

    const { result } = renderHook(() => useRemotePlayer('a-token'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.devices).toEqual([])
  })

  it('reports when no device is awake to control', async () => {
    mockedFetchPlaybackState.mockResolvedValue(undefined)
    mockedFetchDevices.mockResolvedValue([])

    const { result } = renderHook(() => useRemotePlayer('a-token'))

    await waitFor(() => expect(result.current.status).toBe('no-device'))
    expect(result.current.playbackState).toBeUndefined()
  })

  it('pauses a playing device and shows it at once', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.togglePlay()
    })

    expect(pausePlayback).toHaveBeenCalledWith('a-token')
    // The button state must not wait for a poll to come back.
    expect(result.current.playbackState?.isPaused).toBe(true)
  })

  it('resumes a paused device', async () => {
    mockedFetchPlaybackState.mockResolvedValue({ ...apiState, is_playing: false })
    const { result } = renderHook(() => useRemotePlayer('a-token'))
    await waitFor(() => expect(result.current.playbackState?.isPaused).toBe(true))

    act(() => {
      result.current.togglePlay()
    })

    expect(resumePlayback).toHaveBeenCalledWith('a-token')
  })

  it('sends the transport and seek commands', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.nextTrack()
      result.current.previousTrack()
      result.current.seek(30_000)
    })

    expect(skipToNext).toHaveBeenCalledWith('a-token')
    expect(skipToPrevious).toHaveBeenCalledWith('a-token')
    expect(seekToPosition).toHaveBeenCalledWith('a-token', 30_000)
    expect(result.current.playbackState?.positionMs).toBe(30_000)
  })

  it('jumps to a track on the active device, keeping the context', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.playTrack('spotify:playlist:p1', 'spotify:track:7')
    })

    expect(playTrackInContext).toHaveBeenCalledWith({
      accessToken: 'a-token',
      contextUri: 'spotify:playlist:p1',
      trackUri: 'spotify:track:7',
    })
  })

  it('moves playback to another device', async () => {
    const { result } = renderHook(() => useRemotePlayer('a-token'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.selectDevice('device-2')
    })

    expect(transferPlayback).toHaveBeenCalledWith('a-token', 'device-2')
  })

  it('reports an error when Spotify cannot be reached', async () => {
    mockedFetchPlaybackState.mockRejectedValue(new Error('nope'))

    const { result } = renderHook(() => useRemotePlayer('a-token'))

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('stops polling once the token is cleared', async () => {
    const { result, rerender } = renderHook(
      ({ token }: { token: string | undefined }) => useRemotePlayer(token),
      { initialProps: { token: 'a-token' as string | undefined } },
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    const callsWhileActive = mockedFetchPlaybackState.mock.calls.length

    rerender({ token: undefined })

    expect(result.current.status).toBe('idle')
    expect(mockedFetchPlaybackState.mock.calls.length).toBe(callsWhileActive)
  })
})
