import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { savePinnedPlaylists } from '~/lib/pinnedPlaylistsStorage'
import { usePinnedPlaylists } from './usePinnedPlaylists'

const STORAGE_KEY = 'spotify-player:pinned-playlists'
const mix = { uri: 'spotify:playlist:mix', name: 'My Mix' }
const focus = { uri: 'spotify:playlist:focus', name: 'Focus' }

describe('usePinnedPlaylists', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => usePinnedPlaylists())

    expect(result.current.pinned).toEqual([])
  })

  it('pins in order and remembers the pins across visits', () => {
    const { result } = renderHook(() => usePinnedPlaylists())

    act(() => {
      result.current.togglePin(mix)
      result.current.togglePin(focus)
    })

    expect(result.current.pinned).toEqual([mix, focus])

    const { result: nextVisit } = renderHook(() => usePinnedPlaylists())
    expect(nextVisit.current.pinned).toEqual([mix, focus])
  })

  it('unpins a playlist that was already pinned', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([mix, focus]))
    const { result } = renderHook(() => usePinnedPlaylists())

    act(() => result.current.togglePin(mix))

    expect(result.current.pinned).toEqual([focus])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([focus])
  })

  it('picks up pins rewritten elsewhere, such as by an import', () => {
    const { result } = renderHook(() => usePinnedPlaylists())

    act(() => savePinnedPlaylists([focus]))

    expect(result.current.pinned).toEqual([focus])
  })

  it('ignores stored pins it cannot read', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(renderHook(() => usePinnedPlaylists()).result.current.pinned).toEqual([])

    localStorage.setItem(STORAGE_KEY, JSON.stringify([mix, { uri: 42 }, null]))
    expect(renderHook(() => usePinnedPlaylists()).result.current.pinned).toEqual([mix])
  })
})
