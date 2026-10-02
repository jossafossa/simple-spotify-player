export const MIN_BPM = 20
export const MAX_BPM = 400

/** Rounded to a tenth: a whole beat per minute drifts seconds apart over a song. */
export const roundBpm = (bpm: number): number => Math.round(bpm * 10) / 10

export const clampBpm = (bpm: number): number => roundBpm(Math.min(Math.max(bpm, MIN_BPM), MAX_BPM))

/** Only the latest taps count, so a tempo can be corrected without starting over. */
const TAPS_COUNTED = 8

/**
 * The tempo of a run of taps, from the time between the first and the last
 * of the latest ones; undefined until there are two.
 */
export const bpmFromTaps = (tapTimesMs: number[]): number | undefined => {
  const counted = tapTimesMs.slice(-TAPS_COUNTED)
  const first = counted[0]
  const last = counted[counted.length - 1]
  if (counted.length < 2 || first === undefined || last === undefined || last <= first) {
    return undefined
  }

  const beatMs = (last - first) / (counted.length - 1)
  return clampBpm(60_000 / beatMs)
}
