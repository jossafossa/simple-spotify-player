import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Playlist } from '~/lib/types'
import { PlaylistPanel } from './PlaylistPanel'

const buildPlaylist = (overrides: Partial<Playlist> = {}): Playlist => ({
  name: 'My Mix',
  tracks: [
    { uri: 'spotify:track:1', name: 'First Song', artistNames: ['Artist One'], durationMs: 60_000 },
    { uri: 'spotify:track:2', name: 'Second Song', artistNames: ['Artist Two'], durationMs: 90_000 },
  ],
  ...overrides,
})

describe('PlaylistPanel', () => {
  it('prompts to start a playlist when there is no context', () => {
    render(
      <PlaylistPanel
        status="empty"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText(/Play a playlist to see its tracks/)).toBeInTheDocument()
  })

  it('explains when the context cannot be listed', () => {
    render(
      <PlaylistPanel
        status="unsupported"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText(/not playing from a playlist or album/)).toBeInTheDocument()
  })

  it('shows an error message when loading failed', () => {
    render(
      <PlaylistPanel
        status="error"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText(/Could not load the tracks/)).toBeInTheDocument()
  })

  it('lists the playlist name, tracks and durations', () => {
    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri="spotify:track:2"
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText('My Mix')).toBeInTheDocument()
    expect(screen.getByText('First Song')).toBeInTheDocument()
    expect(screen.getByText('Artist One')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('marks the currently playing track', () => {
    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri="spotify:track:2"
        onSelectTrack={vi.fn()}
      />,
    )

    const current = screen.getByRole('button', { current: true })
    expect(current).toHaveTextContent('Second Song')
  })

  it('reports the selected track uri when a track is clicked', async () => {
    const handleSelectTrack = vi.fn()
    const user = userEvent.setup()

    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri="spotify:track:1"
        onSelectTrack={handleSelectTrack}
      />,
    )

    await user.click(screen.getByText('Second Song'))

    expect(handleSelectTrack).toHaveBeenCalledWith('spotify:track:2')
  })

  it('shows how many tracks the playlist holds', () => {
    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText('2 tracks')).toBeInTheDocument()
  })

  it('asks the user to re-authorise when the token lacks playlist scopes', () => {
    render(
      <PlaylistPanel
        status="forbidden"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText(/Log out and back in/)).toBeInTheDocument()
  })

  it('explains that Spotify hides its own generated playlists', () => {
    render(
      <PlaylistPanel
        status="inaccessible"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
      />,
    )

    expect(screen.getByText(/does not let apps read its own generated playlists/)).toBeInTheDocument()
  })

  it('drops focus from a clicked row so keyboard controls keep working', async () => {
    const user = userEvent.setup()

    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri="spotify:track:1"
        onSelectTrack={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Second Song'))

    expect(document.activeElement).toBe(document.body)
  })
})
