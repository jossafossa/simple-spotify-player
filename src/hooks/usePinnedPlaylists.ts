import { useCallback, useEffect, useState } from 'react'
import {
  PINNED_PLAYLISTS_CHANGED_EVENT,
  readPinnedPlaylists,
  savePinnedPlaylists,
} from '~/lib/pinnedPlaylistsStorage'
import type { PlaylistSummary } from '~/lib/types'

export type UsePinnedPlaylistsResult = {
  pinned: PlaylistSummary[]
  togglePin: (playlist: PlaylistSummary) => void
}

/** Favourite playlists, remembered per browser, in the order they were pinned. */
export const usePinnedPlaylists = (): UsePinnedPlaylistsResult => {
  const [pinned, setPinned] = useState(readPinnedPlaylists)

  useEffect(() => {
    const syncFromStorage = () => setPinned(readPinnedPlaylists())

    window.addEventListener(PINNED_PLAYLISTS_CHANGED_EVENT, syncFromStorage)
    return () => window.removeEventListener(PINNED_PLAYLISTS_CHANGED_EVENT, syncFromStorage)
  }, [])

  // Kept stable so the memoised browser does not re-render as playback ticks.
  // Reads storage rather than state so two toggles in one event both count.
  const togglePin = useCallback((playlist: PlaylistSummary) => {
    const current = readPinnedPlaylists()
    const isPinned = current.some((entry) => entry.uri === playlist.uri)

    savePinnedPlaylists(
      isPinned
        ? current.filter((entry) => entry.uri !== playlist.uri)
        : [...current, { uri: playlist.uri, name: playlist.name }],
    )
  }, [])

  return { pinned, togglePin }
}
