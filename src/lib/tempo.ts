export const MIN_BPM = 20
export const MAX_BPM = 400

/** Rounded to a tenth: a whole beat per minute drifts seconds apart over a song. */
export const roundBpm = (bpm: number): number => Math.round(bpm * 10) / 10

export const clampBpm = (bpm: number): number => roundBpm(Math.min(Math.max(bpm, MIN_BPM), MAX_BPM))

/** A tempo is only given from this many taps: the first few are seldom even. */
export const MIN_TAPS = 4
/** The latest taps count, so a long run still follows a tempo that is corrected. */
const TAPS_COUNTED = 32
/** How far a gap may stray from the usual one and still count as a beat. */
const STEADY_SHARE = 0.25

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * The tempo of a run of taps: the average gap between them, leaving out the
 * gaps of a tap that missed a beat or came in early. Undefined until there
 * are enough taps to average.
 */
export const bpmFromTaps = (tapTimesMs: number[]): number | undefined => {
  const counted = tapTimesMs.slice(-TAPS_COUNTED)
  if (counted.length < MIN_TAPS) {
    return undefined
  }

  const gaps = counted.slice(1).map((time, index) => time - (counted[index] ?? time))
  const usualGap = median(gaps)
  if (usualGap <= 0) {
    return undefined
  }

  const steadyGaps = gaps.filter((gap) => Math.abs(gap - usualGap) <= usualGap * STEADY_SHARE)
  const beatMs = steadyGaps.reduce((sum, gap) => sum + gap, 0) / steadyGaps.length

  return clampBpm(60_000 / beatMs)
}
