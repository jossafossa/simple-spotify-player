import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
import { useSpotifyPlayer } from '~/hooks/useSpotifyPlayer'
import type { PlaybackState } from '~/lib/types'
import { Player } from './Player'

vi.mock('~/hooks/useSpotifyPlayer', () => ({
  useSpotifyPlayer: vi.fn(),
}))
vi.mock('~/hooks/useKeyboardControls', () => ({
  useKeyboardControls: vi.fn(),
}))

const mockedUseSpotifyPlayer = vi.mocked(useSpotifyPlayer)
const mockedUseKeyboardControls = vi.mocked(useKeyboardControls)

const buildPlaybackState = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: {
    id: 'track-1',
    name: 'Song Title',
    artistNames: ['Artist One', 'Artist Two'],
    albumName: 'Album Name',
    albumImageUrl: 'https://example.com/art.jpg',
    durationMs: 200_000,
  },
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
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    const handlers = mockedUseKeyboardControls.mock.calls[0]![0]
    handlers.onSeekForward()
    expect(seek).toHaveBeenCalledWith(35_000)

    handlers.onSeekBackward()
    expect(seek).toHaveBeenCalledWith(25_000)
  })
})
