import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVolumeControl } from './useVolumeControl'

describe('useVolumeControl', () => {
  it('steps the volume, clamped to 0–100', () => {
    const setVolume = vi.fn()
    const { result, rerender } = renderHook(
      ({ volume }: { volume: number }) => useVolumeControl(volume, setVolume),
      { initialProps: { volume: 98 } },
    )

    result.current.changeVolumeBy(5)
    expect(setVolume).toHaveBeenLastCalledWith(100)

    rerender({ volume: 3 })
    result.current.changeVolumeBy(-5)
    expect(setVolume).toHaveBeenLastCalledWith(0)
  })

  it('mutes, then restores the level from before muting', () => {
    const setVolume = vi.fn()
    const { result, rerender } = renderHook(
      ({ volume }: { volume: number }) => useVolumeControl(volume, setVolume),
      { initialProps: { volume: 70 } },
    )

    act(() => result.current.toggleMute())
    expect(setVolume).toHaveBeenLastCalledWith(0)

    rerender({ volume: 0 })
    expect(result.current.isMuted).toBe(true)

    act(() => result.current.toggleMute())
    expect(setVolume).toHaveBeenLastCalledWith(70)
  })

  it('unmutes to a sensible level when it started at zero', () => {
    const setVolume = vi.fn()
    const { result } = renderHook(() => useVolumeControl(0, setVolume))

    act(() => result.current.toggleMute())

    expect(setVolume).toHaveBeenLastCalledWith(50)
  })

  it('does nothing while the device reports no volume', () => {
    const setVolume = vi.fn()
    const { result } = renderHook(() => useVolumeControl(undefined, setVolume))

    act(() => {
      result.current.changeVolumeBy(5)
      result.current.toggleMute()
    })

    expect(setVolume).not.toHaveBeenCalled()
  })
})
