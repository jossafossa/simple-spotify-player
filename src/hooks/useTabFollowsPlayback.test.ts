import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SongRef } from '~/lib/types'
import { useTabFollowsPlayback } from './useTabFollowsPlayback'

const nemo: SongRef = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }
const amaranth: SongRef = { uri: 'spotify:track:amaranth', name: 'Amaranth', artistNames: ['Nightwish'] }

type Props = {
  playingSong: SongRef | undefined
  openSong: SongRef | undefined
  isViewerOpen: boolean
}

describe('useTabFollowsPlayback', () => {
  const showTabFor = vi.fn()

  const renderFollow = (initial: Props) =>
    renderHook((props: Props) => useTabFollowsPlayback({ ...props, showTabFor }), {
      initialProps: initial,
    })

  beforeEach(() => {
    showTabFor.mockClear()
  })

  it('moves the open tab along when the next song starts', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: nemo, isViewerOpen: true })

    rerender({ playingSong: amaranth, openSong: nemo, isViewerOpen: true })

    expect(showTabFor).toHaveBeenCalledWith(amaranth)
  })

  it('does nothing while no tab is open', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: undefined, isViewerOpen: false })

    rerender({ playingSong: amaranth, openSong: undefined, isViewerOpen: false })

    expect(showTabFor).not.toHaveBeenCalled()
  })

  it('leaves a tab opened for another song alone until the song changes', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: amaranth, isViewerOpen: true })

    rerender({ playingSong: nemo, openSong: amaranth, isViewerOpen: true })
    expect(showTabFor).not.toHaveBeenCalled()

    rerender({ playingSong: { ...nemo, uri: 'spotify:track:next', name: 'Next' }, openSong: amaranth, isViewerOpen: true })
    expect(showTabFor).toHaveBeenCalledOnce()
  })

  it('treats a relinked copy or a remaster of the same song as no change', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: nemo, isViewerOpen: true })

    rerender({
      playingSong: { uri: 'spotify:track:remaster', name: 'Nemo - Remastered 2021', artistNames: ['Nightwish'] },
      openSong: nemo,
      isViewerOpen: true,
    })

    expect(showTabFor).not.toHaveBeenCalled()
  })

  it('does not act on the new song when it is the tab already open', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: amaranth, isViewerOpen: true })

    rerender({ playingSong: amaranth, openSong: amaranth, isViewerOpen: true })

    expect(showTabFor).not.toHaveBeenCalled()
  })

  it('keeps the tab when playback stops', () => {
    const { rerender } = renderFollow({ playingSong: nemo, openSong: nemo, isViewerOpen: true })

    rerender({ playingSong: undefined, openSong: nemo, isViewerOpen: true })
    rerender({ playingSong: nemo, openSong: nemo, isViewerOpen: true })

    expect(showTabFor).not.toHaveBeenCalled()
  })
})
