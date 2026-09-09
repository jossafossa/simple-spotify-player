import { useCallback, useEffect, useState } from 'react'
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
  | 'expired'
  | 'forbidden'
  | 'inaccessible'
  | 'error'

export type UseSpotifyPlaylistResult = {
  status: SpotifyPlaylistStatus
  playlist: Playlist | undefined
  /** The HTTP status behind a failure, so the UI can name it rather than guess. */
  errorStatus: number | undefined
  reload: () => void
}

type LoadedContext = {
  contextUri: string
  status: Exclude<SpotifyPlaylistStatus, 'empty' | 'unsupported' | 'loading'>
  playlist: Playlist | undefined
  errorStatus: number | undefined
}

const toFailureStatus = (status: number): LoadedContext['status'] => {
  // An expired access token is routine and resolves on the next refresh, so it
  // must not be reported as something the user has to go and fix.
  if (status === 401) {
    return 'expired'
  }

  if (status === 403) {
    return 'forbidden'
  }

  // Spotify's own generated playlists (Daily Mix, Discover Weekly, Release
  // Radar, editorial ones) are hidden from apps outside extended quota mode.
  if (status === 404) {
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
  const [reloadCount, setReloadCount] = useState(0)
  const context = parseContextUri(contextUri)

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1)
  }, [])

  useEffect(() => {
    const contextToLoad = parseContextUri(contextUri)

    if (!accessToken || !contextUri || !contextToLoad || !isSupportedContext(contextToLoad)) {
      return
    }

    let isCancelled = false

    fetchContextPlaylist(accessToken, contextToLoad)
      .then((playlist) => {
        if (!isCancelled) {
          setLoaded({ contextUri, status: 'ready', playlist, errorStatus: undefined })
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return
        }

        const errorStatus = error instanceof SpotifyRequestError ? error.status : undefined
        // Logged so the exact request and status are visible when the message
        // on screen isn't enough to tell what Spotify objected to.
        console.error('Could not load the playlist for', contextUri, error)

        setLoaded({
          contextUri,
          status: errorStatus === undefined ? 'error' : toFailureStatus(errorStatus),
          playlist: undefined,
          errorStatus,
        })
      })

    return () => {
      isCancelled = true
    }
  }, [accessToken, contextUri, reloadCount])

  if (!accessToken || !contextUri) {
    return { status: 'empty', playlist: undefined, errorStatus: undefined, reload }
  }

  if (!isSupportedContext(context)) {
    return { status: 'unsupported', playlist: undefined, errorStatus: undefined, reload }
  }

  // A token refresh restarts the fetch; keep showing the tracks we already
  // have for this context instead of blanking the panel.
  if (loaded?.contextUri !== contextUri) {
    return { status: 'loading', playlist: undefined, errorStatus: undefined, reload }
  }

  return {
    status: loaded.status,
    playlist: loaded.playlist,
    errorStatus: loaded.errorStatus,
    reload,
  }
}
