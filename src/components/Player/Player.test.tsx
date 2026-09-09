import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
import { useSpotifyPlayer } from '~/hooks/useSpotifyPlayer'
import { useSpotifyPlaylist } from '~/hooks/useSpotifyPlaylist'
import type { PlaybackState } from '~/lib/types'
import { Player } from './Player'

vi.mock('~/hooks/useSpotifyPlayer', () => ({
  useSpotifyPlayer: vi.fn(),
}))
vi.mock('~/hooks/useKeyboardControls', () => ({
  useKeyboardControls: vi.fn(),
}))
vi.mock('~/hooks/useSpotifyPlaylist', () => ({
  useSpotifyPlaylist: vi.fn(() => ({
    status: 'empty',
    playlist: undefined,
    errorStatus: undefined,
    errorReason: undefined,
    contextType: undefined,
    reload: vi.fn(),
  })),
}))

const mockedUseSpotifyPlayer = vi.mocked(useSpotifyPlayer)
const mockedUseKeyboardControls = vi.mocked(useKeyboardControls)
const mockedUseSpotifyPlaylist = vi.mocked(useSpotifyPlaylist)

const buildPlaybackState = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Song Title',
    artistNames: ['Artist One', 'Artist Two'],
    albumName: 'Album Name',
    albumImageUrl: 'https://example.com/art.jpg',
    durationMs: 200_000,
  },
  contextUri: undefined,
  positionMs: 30_000,
  isPaused: false,
  ...overrides,
})

describe('Player', () => {
  afterEach(() => {
    mockedUseKeyboardControls.mockClear()
  })

  it('shows a connecting message while connecting', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'connecting',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText('Connecting to Spotify…')).toBeInTheDocument()
  })

  it('shows an error message and lets the user log out', async () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'error',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })
    const handleLogout = vi.fn()
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={handleLogout} />)

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(handleLogout).toHaveBeenCalledOnce()
  })

  it('prompts to start playback when ready with no track yet', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Connected\. Open Spotify/)).toBeInTheDocument()
  })

  it('renders track info and wires controls to the player hook', async () => {
    const togglePlay = vi.fn()
    const nextTrack = vi.fn()
    const previousTrack = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay,
      nextTrack,
      previousTrack,
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText('Song Title')).toBeInTheDocument()
    expect(screen.getByText('Artist One, Artist Two')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(togglePlay).toHaveBeenCalledOnce()
  })

  it('registers keyboard controls that seek relative to the current position', () => {
    const seek = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState({ positionMs: 30_000 }),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek,
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    const handlers = mockedUseKeyboardControls.mock.calls[0]![0]
    handlers.onSeekForward()
    expect(seek).toHaveBeenCalledWith(35_000)

    handlers.onSeekBackward()
    expect(seek).toHaveBeenCalledWith(25_000)
  })

  it('jumps to a track picked from the playlist panel, keeping the context', async () => {
    const playTrack = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState({ contextUri: 'spotify:playlist:p1' }),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack,
      playbackErrorMessage: undefined,
      isStalled: false,
    })
    mockedUseSpotifyPlaylist.mockReturnValue({
      status: 'ready',
      playlist: {
        name: 'My Mix',
        tracks: [
          {
            uri: 'spotify:track:other',
            name: 'Other Song',
            artistNames: ['Artist'],
            durationMs: 60_000,
          },
        ],
      },
      errorStatus: undefined,
      errorReason: undefined,
      contextType: 'playlist',
      reload: vi.fn(),
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByText('Other Song'))

    expect(playTrack).toHaveBeenCalledWith('spotify:playlist:p1', 'spotify:track:other')
  })

  it('surfaces an SDK playback error verbatim', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: 'Playback of protected content is not enabled.',
      isStalled: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Playback of protected content is not enabled/)).toBeInTheDocument()
  })

  it('explains a stall as a DRM licence problem', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: true,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Playback stalled/)).toBeInTheDocument()
    expect(screen.getByText(/widevine-license/)).toBeInTheDocument()
  })

  it('keeps the playlist inside the slot that matches the card height', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    // The slot is what lets a long track list scroll instead of stretching
    // the row past the player card.
    const panel = screen.getByRole('complementary', { name: 'Playlist' })
    expect(panel.parentElement?.className).toContain('panelSlot')
  })

  it('loads the playlist for whatever context is playing', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState({ contextUri: 'spotify:playlist:p1' }),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      playTrack: vi.fn(),
      playbackErrorMessage: undefined,
      isStalled: false,
    })
    mockedUseSpotifyPlaylist.mockReturnValue({
      status: 'loading',
      playlist: undefined,
      errorStatus: undefined,
      errorReason: undefined,
      contextType: 'playlist',
      reload: vi.fn(),
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(mockedUseSpotifyPlaylist).toHaveBeenCalledWith('token', 'spotify:playlist:p1')
  })
})
