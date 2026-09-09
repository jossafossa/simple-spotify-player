import { describe, expect, it } from 'vitest'
import { mapSdkStateToPlaybackState } from './mapSdkStateToPlaybackState'

const buildSdkState = (
  overrides: Partial<Spotify.PlaybackState> = {},
): Spotify.PlaybackState =>
  ({
    duration: 200_000,
    paused: false,
    position: 42_000,
    context: { uri: 'spotify:playlist:p1' },
    track_window: {
      current_track: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Song Title',
        artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
        album: {
          name: 'Album Name',
          images: [{ url: 'https://example.com/art.jpg' }],
        },
      },
    },
    ...overrides,
  }) as Spotify.PlaybackState

describe('mapSdkStateToPlaybackState', () => {
  it('maps track, context, position and paused state', () => {
    const result = mapSdkStateToPlaybackState(buildSdkState())

    expect(result).toEqual({
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

  it('leaves contextUri undefined when playback has no context', () => {
    const result = mapSdkStateToPlaybackState(
      buildSdkState({ context: { uri: null } as Spotify.PlaybackContext }),
    )

    expect(result.contextUri).toBeUndefined()
  })

  it('falls back to an empty id when Spotify omits one', () => {
    const state = buildSdkState({
      track_window: {
        current_track: {
          ...buildSdkState().track_window.current_track,
          id: null,
        },
        previous_tracks: [],
        next_tracks: [],
      },
    })

    const result = mapSdkStateToPlaybackState(state)

    expect(result.track.id).toBe('')
  })

  it('leaves albumImageUrl undefined when there are no images', () => {
    const state = buildSdkState({
      track_window: {
        current_track: {
          ...buildSdkState().track_window.current_track,
          album: { name: 'Album Name', uri: '', images: [] },
        },
        previous_tracks: [],
        next_tracks: [],
      },
    })

    const result = mapSdkStateToPlaybackState(state)

    expect(result.track.albumImageUrl).toBeUndefined()
  })
})
