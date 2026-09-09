import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTickingPosition } from './useTickingPosition'
import type { PlaybackState } from '~/lib/types'

const buildPlaybackState = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Song',
    artistNames: ['Artist'],
    albumName: 'Album',
    albumImageUrl: undefined,
    durationMs: 200_000,
  },
  contextUri: undefined,
  positionMs: 10_000,
  isPaused: false,
  ...overrides,
})

describe('useTickingPosition', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 when there is no playback state', () => {
    const { result } = renderHook(() => useTickingPosition(undefined))

    expect(result.current).toBe(0)
  })

  it('returns the reported position immediately', () => {
    const { result } = renderHook(() => useTickingPosition(buildPlaybackState()))

    expect(result.current).toBe(10_000)
  })

  it('advances position over time while playing', async () => {
    const playbackState = buildPlaybackState()
    const { result } = renderHook(() => useTickingPosition(playbackState))

    await act(() => vi.advanceTimersByTimeAsync(1_000))

    expect(result.current).toBeGreaterThanOrEqual(10_900)
  })

  it('does not advance while paused', async () => {
    const playbackState = buildPlaybackState({ isPaused: true })
    const { result } = renderHook(() => useTickingPosition(playbackState))

    await act(() => vi.advanceTimersByTimeAsync(2_000))

    expect(result.current).toBe(10_000)
  })

  it('clamps to the track duration', async () => {
    const playbackState = buildPlaybackState({
      positionMs: 199_000,
      track: { ...buildPlaybackState().track, durationMs: 200_000 },
    })
    const { result } = renderHook(() => useTickingPosition(playbackState))

    await act(() => vi.advanceTimersByTimeAsync(5_000))

    expect(result.current).toBe(200_000)
  })
})
