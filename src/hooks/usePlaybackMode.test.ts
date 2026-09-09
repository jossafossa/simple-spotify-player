import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectWidevineSupport } from '~/lib/playbackMode'
import { usePlaybackMode } from './usePlaybackMode'

vi.mock('~/lib/playbackMode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/playbackMode')>()),
  detectWidevineSupport: vi.fn(),
}))

const mockedDetectWidevineSupport = vi.mocked(detectWidevineSupport)

describe('usePlaybackMode', () => {
  beforeEach(() => {
    localStorage.clear()
    mockedDetectWidevineSupport.mockReset()
    mockedDetectWidevineSupport.mockResolvedValue(true)
  })

  it('defaults to playing in the page where Widevine works', async () => {
    const { result } = renderHook(() => usePlaybackMode())

    expect(result.current.mode).toBeUndefined()
    await waitFor(() => expect(result.current.mode).toBe('local'))
  })

  it('defaults to remote control where Widevine is missing', async () => {
    mockedDetectWidevineSupport.mockResolvedValue(false)

    const { result } = renderHook(() => usePlaybackMode())

    await waitFor(() => expect(result.current.mode).toBe('remote'))
  })

  it('defaults to remote control after local playback has stalled here', async () => {
    localStorage.setItem('spotify-player:local-playback-failed', 'true')

    const { result } = renderHook(() => usePlaybackMode())

    await waitFor(() => expect(result.current.mode).toBe('remote'))
  })

  it('boots straight into a remembered mode without detecting anything', () => {
    localStorage.setItem('spotify-player:playback-mode', 'remote')

    const { result } = renderHook(() => usePlaybackMode())

    expect(result.current.mode).toBe('remote')
    expect(mockedDetectWidevineSupport).not.toHaveBeenCalled()
  })

  it('remembers a chosen mode for next time', async () => {
    const { result } = renderHook(() => usePlaybackMode())

    await waitFor(() => expect(result.current.mode).toBe('local'))

    act(() => {
      result.current.setMode('remote')
    })

    expect(result.current.mode).toBe('remote')
    expect(localStorage.getItem('spotify-player:playback-mode')).toBe('remote')
  })

  it('keeps an explicit choice of local playback even after a stall', async () => {
    const { result } = renderHook(() => usePlaybackMode())
    await waitFor(() => expect(result.current.mode).toBe('local'))

    act(() => {
      result.current.setMode('local')
      result.current.reportLocalPlaybackFailure()
    })

    expect(localStorage.getItem('spotify-player:local-playback-failed')).toBe('true')
    // The failure moves the default, and the user's choice still outranks it.
    const { result: reopened } = renderHook(() => usePlaybackMode())
    expect(reopened.current.mode).toBe('local')
  })
})
