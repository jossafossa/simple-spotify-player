import { beforeEach, describe, expect, it } from 'vitest'
import {
  readLocalPlaybackFailed,
  readStoredPlaybackMode,
  saveLocalPlaybackCapability,
  saveStoredPlaybackMode,
} from './playbackModeStorage'

describe('playback mode storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is undefined until a mode has been chosen', () => {
    expect(readStoredPlaybackMode()).toBeUndefined()
  })

  it('round-trips a chosen mode', () => {
    saveStoredPlaybackMode('remote')
    expect(readStoredPlaybackMode()).toBe('remote')

    saveStoredPlaybackMode('local')
    expect(readStoredPlaybackMode()).toBe('local')
  })

  it('ignores a stored value that is not a mode', () => {
    localStorage.setItem('spotify-player:playback-mode', 'sideways')
    expect(readStoredPlaybackMode()).toBeUndefined()
  })

  it('reports no failure until a licence request has been seen', () => {
    expect(readLocalPlaybackFailed()).toBe(false)
  })

  it('records a refused licence as a failure', () => {
    saveLocalPlaybackCapability(false)
    expect(readLocalPlaybackFailed()).toBe(true)
  })

  it('lets a granted licence clear an earlier failure', () => {
    saveLocalPlaybackCapability(false)
    saveLocalPlaybackCapability(true)

    // A browser that once failed must not be written off for good.
    expect(readLocalPlaybackFailed()).toBe(false)
  })
})
