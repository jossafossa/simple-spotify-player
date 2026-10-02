import { useCallback, useState } from 'react'
import { readPinnedPlaylists, savePinnedPlaylists } from '~/lib/pinnedPlaylistsStorage'
import type { PlaylistSummary } from '~/lib/types'

export type UsePinnedPlaylistsResult = {
  pinned: PlaylistSummary[]
  togglePin: (playlist: PlaylistSummary) => void
}

/** Favourite playlists, remembered per browser, in the order they were pinned. */
export const usePinnedPlaylists = (): UsePinnedPlaylistsResult => {
  const [pinned, setPinned] = useState(readPinnedPlaylists)

  // Kept stable so the memoised browser does not re-render as playback ticks.
  const togglePin = useCallback((playlist: PlaylistSummary) => {
    setPinned((current) => {
      const isPinned = current.some((entry) => entry.uri === playlist.uri)
      const next = isPinned
        ? current.filter((entry) => entry.uri !== playlist.uri)
        : [...current, { uri: playlist.uri, name: playlist.name }]

      savePinnedPlaylists(next)
      return next
    })
  }, [])

  return { pinned, togglePin }
}
