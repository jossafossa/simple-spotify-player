import { useState } from 'react'
import { readTabSettings, saveTabSettings } from '~/lib/tabSettingsStorage'
import { clampBpm } from '~/lib/tempo'

export type UseTabTempoResult = {
  /** The recording's tempo, when one was set for the tab. */
  bpm: number | undefined
  setBpm: (bpm: number) => void
  /** Goes back to the tempo the tab is written in. */
  reset: () => void
}

/**
 * The tempo of the recording a tab is played along with, remembered per tab.
 * A transcription is often written a touch off the recording's tempo, which
 * pulls a synced cursor further away the longer the song plays.
 */
export const useTabTempo = (tabId: string): UseTabTempoResult => {
  const [bpm, setBpmState] = useState(() => readTabSettings(tabId).bpm)

  const change = (next: number | undefined) => {
    setBpmState(next)
    saveTabSettings(tabId, { bpm: next })
  }

  return {
    bpm,
    setBpm: (next) => change(clampBpm(next)),
    reset: () => change(undefined),
  }
}
