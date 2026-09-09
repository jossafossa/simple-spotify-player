import { describe, expect, it } from 'vitest'
import { mapApiStateToPlaybackState } from './mapApiStateToPlaybackState'

const apiState = {
  is_playing: true,
  progress_ms: 42_000,
  context: { uri: 'spotify:playlist:p1' },
  device: { id: 'device-1', name: 'Kitchen speaker', is_active: true },
  item: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Song Title',
    duration_ms: 200_000,
    artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
    album: { name: 'Album Name', images: [{ url: 'https://example.com/art.jpg' }] },
  },
}

describe('mapApiStateToPlaybackState', () => {
  it('maps a remote playback response', () => {
    expect(mapApiStateToPlaybackState(apiState)).toEqual({
      track: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Song Title',
        artistNames: ['Artist One', 'Artist Two'],
        albumName: 'Album Name',
        albumImageUrl: 'https://example.com/art.jpg',
        durationMs: 200_000,
      },
      contextUri: 'spotify:playlist:p1',
      positionMs: 42_000,
      isPaused: false,
    })
  })

  it('treats a missing is_playing as paused', () => {
    expect(mapApiStateToPlaybackState({ ...apiState, is_playing: false })?.isPaused).toBe(true)
  })

  it('is undefined when Spotify reports nothing playing', () => {
    expect(mapApiStateToPlaybackState(undefined)).toBeUndefined()
    expect(mapApiStateToPlaybackState({ is_playing: false })).toBeUndefined()
  })

  it('survives a sparse item', () => {
    const result = mapApiStateToPlaybackState({ item: { uri: 'spotify:track:x' } })

    expect(result?.track.name).toBe('Unknown track')
    expect(result?.track.artistNames).toEqual([])
    expect(result?.track.albumImageUrl).toBeUndefined()
    expect(result?.contextUri).toBeUndefined()
  })
})
