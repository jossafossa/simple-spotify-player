import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteTabSettings,
  parseAllTabSettings,
  readAllTabSettings,
  readTabSettings,
  saveTabSettings,
} from './tabSettingsStorage'

describe('tab settings storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('remembers offset and track per tab, merging changes', () => {
    saveTabSettings('a', { offsetMs: 500 })
    saveTabSettings('a', { trackIndex: 2 })
    saveTabSettings('b', { trackIndex: 1 })

    expect(readTabSettings('a')).toEqual({ offsetMs: 500, trackIndex: 2 })
    expect(readTabSettings('b')).toEqual({ trackIndex: 1 })
    expect(readTabSettings('unknown')).toEqual({})
  })

  it('remembers a tempo within range, and ignores one outside it', () => {
    saveTabSettings('a', { bpm: 121.5 })
    expect(readTabSettings('a')).toEqual({ bpm: 121.5 })

    expect(parseAllTabSettings({ a: { bpm: 2 }, b: { bpm: 'fast' } })).toEqual({})
  })

  it('forgets values that are back at their default', () => {
    saveTabSettings('a', { offsetMs: 500, trackIndex: 2 })

    saveTabSettings('a', { offsetMs: 0, trackIndex: 0 })

    expect(readAllTabSettings()).toEqual({})
  })

  it('picks up offsets saved before the track was remembered too', () => {
    localStorage.setItem('spotify-player:tab-sync-offsets', JSON.stringify({ a: -1_000, b: 'x' }))

    expect(readTabSettings('a')).toEqual({ offsetMs: -1_000 })

    saveTabSettings('a', { trackIndex: 1 })
    expect(localStorage.getItem('spotify-player:tab-sync-offsets')).toBeNull()
    expect(readTabSettings('a')).toEqual({ offsetMs: -1_000, trackIndex: 1 })
  })

  it('deletes a tab’s settings', () => {
    saveTabSettings('a', { offsetMs: 500 })

    deleteTabSettings('a')

    expect(readTabSettings('a')).toEqual({})
  })

  it('ignores damaged entries and damaged storage', () => {
    expect(
      parseAllTabSettings({ a: { offsetMs: Number.NaN }, b: { trackIndex: 1.5 }, c: { trackIndex: 3 } }),
    ).toEqual({ c: { trackIndex: 3 } })
    expect(parseAllTabSettings([1, 2])).toEqual({})

    localStorage.setItem('spotify-player:tab-settings', '{nope')
    expect(readAllTabSettings()).toEqual({})
  })
})
