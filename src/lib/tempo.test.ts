import { describe, expect, it } from 'vitest'
import { bpmFromTaps, clampBpm } from './tempo'

describe('bpmFromTaps', () => {
  it('needs two taps', () => {
    expect(bpmFromTaps([])).toBeUndefined()
    expect(bpmFromTaps([1000])).toBeUndefined()
  })

  it('averages the time between taps', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
    expect(bpmFromTaps([0, 480, 1010, 1500])).toBe(120)
  })

  it('counts only the latest eight taps', () => {
    const slow = [0, 1000, 2000]
    const fast = [2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000]

    expect(bpmFromTaps([...slow, ...fast])).toBe(120)
  })

  it('keeps a tenth of a beat per minute', () => {
    expect(bpmFromTaps([0, 600, 1210])).toBe(99.2)
  })
})

describe('clampBpm', () => {
  it('keeps a tempo within what can be played', () => {
    expect(clampBpm(5)).toBe(20)
    expect(clampBpm(1000)).toBe(400)
    expect(clampBpm(121.04)).toBe(121)
  })
})
