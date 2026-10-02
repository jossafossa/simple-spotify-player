import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTapTempo } from './useTapTempo'

describe('useTapTempo', () => {
  let now = 0

  beforeEach(() => {
    now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const tapAt = (tap: () => void, timeMs: number) => {
    now = timeMs
    act(() => tap())
  }

  it('reports the tempo from the second tap on', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm))

    tapAt(result.current, 0)
    expect(onBpm).not.toHaveBeenCalled()

    tapAt(result.current, 500)
    expect(onBpm).toHaveBeenLastCalledWith(120)

    tapAt(result.current, 1000)
    expect(onBpm).toHaveBeenCalledTimes(2)
  })

  it('starts counting again after a pause', () => {
    const onBpm = vi.fn()
    const { result } = renderHook(() => useTapTempo(onBpm))

    tapAt(result.current, 0)
    tapAt(result.current, 500)
    tapAt(result.current, 5000)
    expect(onBpm).toHaveBeenCalledTimes(1)

    tapAt(result.current, 6000)
    expect(onBpm).toHaveBeenLastCalledWith(60)
  })
  it('taps on the T key, but not while typing', () => {
    const onBpm = vi.fn()
    renderHook(() => useTapTempo(onBpm))
    const input = document.createElement('input')
    document.body.append(input)

    now = 0
    fireEvent.keyDown(window, { key: 't' })
    now = 400
    fireEvent.keyDown(input, { key: 't' })
    now = 500
    fireEvent.keyDown(window, { key: 't' })

    expect(onBpm).toHaveBeenCalledOnce()
    expect(onBpm).toHaveBeenCalledWith(120)
    input.remove()
  })
})
