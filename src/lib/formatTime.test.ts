import { describe, expect, it } from 'vitest'
import { formatTime } from './formatTime'

describe('formatTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('pads seconds under ten', () => {
    expect(formatTime(5_000)).toBe('0:05')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(125_000)).toBe('2:05')
  })

  it('floors partial seconds', () => {
    expect(formatTime(1_999)).toBe('0:01')
  })

  it('clamps negative durations to zero', () => {
    expect(formatTime(-500)).toBe('0:00')
  })
})
