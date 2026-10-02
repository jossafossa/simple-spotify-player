import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readTabSettings } from '~/lib/tabSettingsStorage'
import { readTabSyncEnabled } from '~/lib/tabSyncStorage'
import { useTabSync } from './useTabSync'

type Props = { positionMs: number | undefined; canSeek: boolean }

const renderSync = (initial: Props = { positionMs: 10_000, canSeek: true }) => {
  const seekTo = vi.fn()
  const view = renderHook(
    (props: Props) => useTabSync({ tabId: 'tab-1', seekTo, ...props }),
    { initialProps: initial },
  )
  return { ...view, seekTo }
}

describe('useTabSync', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is off by default and leaves the tab alone', () => {
    const { result, seekTo } = renderSync()

    expect(result.current.isEnabled).toBe(false)
    expect(seekTo).not.toHaveBeenCalled()
  })

  it('moves the tab to Spotify’s position once switched on, and on every new position', () => {
    const { result, seekTo, rerender } = renderSync()

    act(() => result.current.setEnabled(true))
    expect(seekTo).toHaveBeenLastCalledWith(10_000)

    rerender({ positionMs: 10_250, canSeek: true })
    expect(seekTo).toHaveBeenLastCalledWith(10_250)
    expect(readTabSyncEnabled()).toBe(true)
  })

  it('does not seek again just because it re-rendered', () => {
    const { result, seekTo, rerender } = renderSync()
    act(() => result.current.setEnabled(true))
    seekTo.mockClear()

    rerender({ positionMs: 10_000, canSeek: true })

    expect(seekTo).not.toHaveBeenCalled()
  })

  it('waits until the tab can be moved, and while nothing plays', () => {
    const { result, seekTo, rerender } = renderSync({ positionMs: 5_000, canSeek: false })
    act(() => result.current.setEnabled(true))
    rerender({ positionMs: undefined, canSeek: true })

    expect(seekTo).not.toHaveBeenCalled()
  })

  it('applies an offset, never before the start, and remembers it per tab', () => {
    const { result, seekTo } = renderSync({ positionMs: 1_000, canSeek: true })
    act(() => result.current.setEnabled(true))

    act(() => result.current.nudge(500))
    expect(seekTo).toHaveBeenLastCalledWith(1_500)
    expect(readTabSettings('tab-1').offsetMs).toBe(500)

    act(() => result.current.nudge(-3_000))
    expect(seekTo).toHaveBeenLastCalledWith(0)

    act(() => result.current.resetOffset())
    expect(result.current.offsetMs).toBe(0)
    expect(readTabSettings('tab-1').offsetMs).toBeUndefined()
  })

  it('starts from the remembered setting and offset', () => {
    localStorage.setItem('spotify-player:tab-sync', 'true')
    localStorage.setItem('spotify-player:tab-settings', JSON.stringify({ 'tab-1': { offsetMs: -1_500 } }))

    const { result, seekTo } = renderSync({ positionMs: 4_000, canSeek: true })

    expect(result.current.isEnabled).toBe(true)
    expect(result.current.offsetMs).toBe(-1_500)
    expect(seekTo).toHaveBeenLastCalledWith(2_500)
  })

  it('ignores stored offsets it cannot read', () => {
    localStorage.setItem('spotify-player:tab-settings', '{nope')

    expect(renderSync().result.current.offsetMs).toBe(0)
  })
})
