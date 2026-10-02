import { useState } from 'react'

export type UseVolumeControlResult = {
  isMuted: boolean
  changeVolumeBy: (deltaPercent: number) => void
  toggleMute: () => void
}

/** What unmuting falls back to when the volume was already zero to begin with. */
const DEFAULT_UNMUTE_PERCENT = 50

/**
 * Stepping and muting on top of a player's raw volume. Muting is just a volume
 * of zero, so it also shows on other Spotify clients; the level from before is
 * remembered here so unmuting can put it back.
 */
export const useVolumeControl = (
  volume: number | undefined,
  setVolume: (volumePercent: number) => void,
): UseVolumeControlResult => {
  const [volumeBeforeMute, setVolumeBeforeMute] = useState<number>()
  const isMuted = volume === 0

  const changeVolumeBy = (deltaPercent: number) => {
    if (volume === undefined) {
      return
    }

    setVolume(Math.min(Math.max(volume + deltaPercent, 0), 100))
  }

  const toggleMute = () => {
    if (volume === undefined) {
      return
    }

    if (isMuted) {
      setVolume(volumeBeforeMute || DEFAULT_UNMUTE_PERCENT)
      return
    }

    setVolumeBeforeMute(volume)
    setVolume(0)
  }

  return { isMuted, changeVolumeBy, toggleMute }
}
