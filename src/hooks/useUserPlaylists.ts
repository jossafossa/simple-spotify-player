import { useEffect, useState } from 'react'
import { fetchUserPlaylists } from '~/lib/spotifyApi'
import type { PlaylistSummary } from '~/lib/types'

export type UserPlaylistsStatus = 'loading' | 'ready' | 'error'

export type UseUserPlaylistsResult = {
  status: UserPlaylistsStatus
  playlists: PlaylistSummary[]
}

type Loaded = {
  accessToken: string
  status: Exclude<UserPlaylistsStatus, 'loading'>
  playlists: PlaylistSummary[]
}

/**
 * Lists the user's playlists once per token. A refreshed token refetches, but
 * keeps showing the list it already has until the new one arrives.
 */
export const useUserPlaylists = (accessToken: string | undefined): UseUserPlaylistsResult => {
  const [loaded, setLoaded] = useState<Loaded>()

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isCancelled = false

    fetchUserPlaylists(accessToken)
      .then((playlists) => {
        if (!isCancelled) {
          setLoaded({ accessToken, status: 'ready', playlists })
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return
        }

        console.error('Could not list your playlists', error)
        setLoaded((previous) =>
          previous?.status === 'ready' ? previous : { accessToken, status: 'error', playlists: [] },
        )
      })

    return () => {
      isCancelled = true
    }
  }, [accessToken])

  if (!loaded) {
    return { status: 'loading', playlists: [] }
  }

  return { status: loaded.status, playlists: loaded.playlists }
}
