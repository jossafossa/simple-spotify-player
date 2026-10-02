import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { readTabSettings, saveTabSettings } from '~/lib/tabSettingsStorage'
import { useTabTempo } from './useTabTempo'

describe('useTabTempo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('has no tempo of its own until one is set', () => {
    const { result } = renderHook(() => useTabTempo('tab-1'))

    expect(result.current.bpm).toBeUndefined()
  })

  it('remembers a set tempo per tab', () => {
    const { result } = renderHook(() => useTabTempo('tab-1'))

    act(() => result.current.setBpm(126))

    expect(result.current.bpm).toBe(126)
    expect(readTabSettings('tab-1').bpm).toBe(126)
  })

  it('starts from the tempo remembered for the tab', () => {
    saveTabSettings('tab-1', { bpm: 90 })

    const { result } = renderHook(() => useTabTempo('tab-1'))

    expect(result.current.bpm).toBe(90)
  })

  it('forgets the set tempo on reset', () => {
    const { result } = renderHook(() => useTabTempo('tab-1'))
    act(() => result.current.setBpm(100))

    act(() => result.current.reset())

    expect(result.current.bpm).toBeUndefined()
    expect(readTabSettings('tab-1')).toEqual({})
  })

  it('keeps a tempo within range', () => {
    const { result } = renderHook(() => useTabTempo('tab-1'))

    act(() => result.current.setBpm(1))

    expect(result.current.bpm).toBe(20)
  })
})
