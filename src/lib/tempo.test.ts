import { describe, expect, it } from 'vitest'
import { bpmFromTaps, clampBpm } from './tempo'

const tapsEvery = (gapMs: number, count: number, startMs = 0) =>
  Array.from({ length: count }, (_, index) => startMs + index * gapMs)

describe('bpmFromTaps', () => {
  it('waits for four taps', () => {
    expect(bpmFromTaps([])).toBeUndefined()
    expect(bpmFromTaps([0, 500, 1000])).toBeUndefined()
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
  })

  it('averages every gap, so uneven taps even out', () => {
    expect(bpmFromTaps([0, 480, 1010, 1500, 1990, 2510, 3000])).toBe(120)
  })

  it('leaves out a missed beat and a tap that came in early', () => {
    const missedBeat = [0, 500, 1000, 2000, 2500, 3000]
    const early = [0, 500, 1000, 1300, 1500, 2000, 2500]

    expect(bpmFromTaps(missedBeat)).toBe(120)
    expect(bpmFromTaps(early)).toBe(120)
  })

  it('counts only the latest 32 taps', () => {
    const slow = tapsEvery(1000, 10)
    const fast = tapsEvery(500, 32, 10_000)

    expect(bpmFromTaps([...slow, ...fast])).toBe(120)
  })

  it('keeps a tenth of a beat per minute', () => {
    expect(bpmFromTaps(tapsEvery(605, 5))).toBe(99.2)
  })
})

describe('clampBpm', () => {
  it('keeps a tempo within what can be played', () => {
    expect(clampBpm(5)).toBe(20)
    expect(clampBpm(1000)).toBe(400)
    expect(clampBpm(121.04)).toBe(121)
  })
})
