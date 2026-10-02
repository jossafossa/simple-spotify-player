import { useEffect, useRef } from 'react'
import { isSameSong } from '~/lib/songMatch'
import type { SongRef } from '~/lib/types'

type TabFollowsPlaybackInput = {
  /** The song Spotify is playing, or undefined while nothing is. */
  playingSong: SongRef | undefined
  /** The song whose tab is open in the viewer, if any. */
  openSong: SongRef | undefined
  isViewerOpen: boolean
  /** Opens the playing song's tab, or closes the viewer when it has none. */
  showTabFor: (song: SongRef) => void
}

/**
 * When the next song starts, the open tab follows it: the new song's tab
 * opens if it has one, and the viewer closes if it does not. Only a change of
 * song does this — a tab opened for another song stays put until then.
 */
export const useTabFollowsPlayback = ({
  playingSong,
  openSong,
  isViewerOpen,
  showTabFor,
}: TabFollowsPlaybackInput): void => {
  const previousSongRef = useRef(playingSong)
  // The latest values, read when the song changes rather than reacted to.
  const latestRef = useRef({ openSong, isViewerOpen, showTabFor })

  useEffect(() => {
    latestRef.current = { openSong, isViewerOpen, showTabFor }
  })

  const playingUri = playingSong?.uri

  useEffect(() => {
    const previous = previousSongRef.current
    previousSongRef.current = playingSong

    // Nothing playing any more leaves the tab where it is.
    if (!playingSong || !previous || isSameSong(previous, playingSong)) {
      return
    }

    const { openSong: current, isViewerOpen: isOpen, showTabFor: show } = latestRef.current
    if (!isOpen || (current && isSameSong(current, playingSong))) {
      return
    }

    show(playingSong)
    // Keyed on the URI alone: the song object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingUri])
}
