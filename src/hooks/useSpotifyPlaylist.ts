import { useEffect, useState } from 'react'
import {
  fetchContextPlaylist,
  isSupportedContext,
  parseContextUri,
  SpotifyRequestError,
} from '~/lib/spotifyApi'
import type { Playlist } from '~/lib/types'

export type SpotifyPlaylistStatus =
  | 'empty'
  | 'unsupported'
  | 'loading'
  | 'ready'
  | 'forbidden'
  | 'inaccessible'
  | 'error'

export type UseSpotifyPlaylistResult = {
  status: SpotifyPlaylistStatus
  playlist: Playlist | undefined
}

type LoadedContext = {
  contextUri: string
  status: Exclude<SpotifyPlaylistStatus, 'empty' | 'unsupported' | 'loading'>
  playlist: Playlist | undefined
}

const toFailureStatus = (error: unknown): LoadedContext['status'] => {
  if (!(error instanceof SpotifyRequestError)) {
    return 'error'
  }

  // A token issued before a scope was added still authenticates, it just
  // cannot read playlists — that needs a fresh sign-in, not a retry.
  if (error.status === 401 || error.status === 403) {
    return 'forbidden'
  }

  // Spotify's own generated playlists (Daily Mix, Discover Weekly, Release
  // Radar, editorial ones) are hidden from third-party apps entirely.
  if (error.status === 404) {
    return 'inaccessible'
  }

  return 'error'
}

/**
 * Loads the tracks of whatever the player is currently playing from. The
 * context URI only changes when playback moves to another playlist, so
 * skipping tracks does not refetch.
 */
export const useSpotifyPlaylist = (
  accessToken: string | undefined,
  contextUri: string | undefined,
): UseSpotifyPlaylistResult => {
  const [loaded, setLoaded] = useState<LoadedContext>()
  const context = parseContextUri(contextUri)

  useEffect(() => {
    const contextToLoad = parseContextUri(contextUri)

    if (!accessToken || !contextUri || !contextToLoad || !isSupportedContext(contextToLoad)) {
      return
    }

    let isCancelled = false

    fetchContextPlaylist(accessToken, contextToLoad)
      .then((playlist) => {
        if (!isCancelled) {
          setLoaded({ contextUri, status: 'ready', playlist })
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setLoaded({ contextUri, status: toFailureStatus(error), playlist: undefined })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [accessToken, contextUri])

  if (!accessToken || !contextUri) {
    return { status: 'empty', playlist: undefined }
  }

  if (!isSupportedContext(context)) {
    return { status: 'unsupported', playlist: undefined }
  }

  // A token refresh restarts the fetch; keep showing the tracks we already
  // have for this context instead of blanking the panel.
  if (loaded?.contextUri !== contextUri) {
    return { status: 'loading', playlist: undefined }
  }

  return { status: loaded.status, playlist: loaded.playlist }
}
