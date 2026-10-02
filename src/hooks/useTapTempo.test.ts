import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTapTempo } from './useTapTempo'

describe('useTapTempo', () => {
  let now = 0

  beforeEach(() => {
    now = 0
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const tapAt = (tap: () => void, timeMs: number) => {
    now = timeMs
    act(() => tap())
  }

  it('reports the averaged tempo from the fourth tap on, counting the taps', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm))

    tapAt(result.current.tap, 0)
    tapAt(result.current.tap, 500)
    tapAt(result.current.tap, 1000)
    expect(onBpm).not.toHaveBeenCalled()
    expect(result.current.tapCount).toBe(3)

    tapAt(result.current.tap, 1500)
    expect(onBpm).toHaveBeenLastCalledWith(120)

    tapAt(result.current.tap, 2000)
    expect(onBpm).toHaveBeenCalledTimes(2)
  })

  it('starts a new count after a pause', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm))
    ;[0, 500, 1000].forEach((time) => tapAt(result.current.tap, time))

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.tapCount).toBe(0)

    ;[5000, 6000, 7000].forEach((time) => tapAt(result.current.tap, time))
    expect(onBpm).not.toHaveBeenCalled()
    tapAt(result.current.tap, 8000)
    expect(onBpm).toHaveBeenLastCalledWith(60)
  })

  it('taps on the T key, but not while typing', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm))
    const input = document.createElement('input')
    document.body.append(input)

    now = 0
    act(() => {
      fireEvent.keyDown(window, { key: 't' })
    })
    now = 400
    act(() => {
      fireEvent.keyDown(input, { key: 't' })
    })

    expect(result.current.tapCount).toBe(1)
    input.remove()
  })
})
