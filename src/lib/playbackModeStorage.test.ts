import { beforeEach, describe, expect, it } from 'vitest'
import {
  readLocalPlaybackFailed,
  readStoredPlaybackMode,
  saveLocalPlaybackFailed,
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

  it('round-trips the local playback failure flag', () => {
    expect(readLocalPlaybackFailed()).toBe(false)

    saveLocalPlaybackFailed()
    expect(readLocalPlaybackFailed()).toBe(true)
  })
})
