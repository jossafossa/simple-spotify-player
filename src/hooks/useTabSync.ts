import { useEffect, useRef, useState } from 'react'
import { readTabSettings, saveTabSettings } from '~/lib/tabSettingsStorage'
import { readTabSyncEnabled, saveTabSyncEnabled } from '~/lib/tabSyncStorage'

export type UseTabSyncResult = {
  isEnabled: boolean
  setEnabled: (isEnabled: boolean) => void
  /** Added to Spotify's position before the tab is moved there. */
  offsetMs: number
  nudge: (deltaMs: number) => void
  resetOffset: () => void
  /**
   * Lines the tab up so the given moment in it is where Spotify is now — for
   * a click on the note that is sounding.
   */
  alignTo: (tabTimeMs: number) => void
}

type TabSyncInput = {
  tabId: string
  /** Spotify's position in the song, or undefined when nothing is playing. */
  positionMs: number | undefined
  /** False until the tab can be moved, i.e. alphaTab's player is ready. */
  canSeek: boolean
  seekTo: (positionMs: number) => void
}

/**
 * Lets the tab's cursor follow Spotify instead of alphaTab's own player.
 * Optional and off by default: a transcription's tempo seldom matches the
 * recording exactly, so the offset is there to line the two up.
 */
export const useTabSync = ({ tabId, positionMs, canSeek, seekTo }: TabSyncInput): UseTabSyncResult => {
  const [isEnabled, setIsEnabled] = useState(readTabSyncEnabled)
  const [offsetMs, setOffsetMs] = useState(() => readTabSettings(tabId).offsetMs ?? 0)
  // The latest seek, kept out of the effect so a new function each render
  // does not seek again; only a new position or offset should.
  const seekToRef = useRef(seekTo)

  useEffect(() => {
    seekToRef.current = seekTo
  })

  useEffect(() => {
    if (!isEnabled || !canSeek || positionMs === undefined) {
      return
    }

    seekToRef.current(Math.max(positionMs + offsetMs, 0))
  }, [isEnabled, canSeek, positionMs, offsetMs])

  const changeOffset = (next: number) => {
    setOffsetMs(next)
    saveTabSettings(tabId, { offsetMs: next })
  }

  return {
    isEnabled,
    setEnabled: (next) => {
      setIsEnabled(next)
      saveTabSyncEnabled(next)
    },
    offsetMs,
    nudge: (deltaMs) => changeOffset(offsetMs + deltaMs),
    resetOffset: () => changeOffset(0),
    alignTo: (tabTimeMs) => {
      if (isEnabled && positionMs !== undefined) {
        changeOffset(Math.round(tabTimeMs - positionMs))
      }
    },
  }
}
