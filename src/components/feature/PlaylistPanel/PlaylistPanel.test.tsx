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
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/Play a playlist or album to see its tracks/)).toBeInTheDocument()
  })

  it('explains when the context cannot be listed', () => {
    render(
      <PlaylistPanel
        status="unsupported"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/no track list to jump around/)).toBeInTheDocument()
  })

  it('shows an error message when loading failed', () => {
    render(
      <PlaylistPanel
        status="error"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
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
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
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
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
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
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
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
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText('2 tracks')).toBeInTheDocument()
  })

  it('names the ownership rule when Spotify refuses a playlist listing', () => {
    render(
      <PlaylistPanel
        status="forbidden"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/only shares playlists you own or collaborate on/)).toBeInTheDocument()
  })

  it('explains that Spotify hides its own generated playlists', () => {
    render(
      <PlaylistPanel
        status="inaccessible"
        playlist={undefined}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/hides its own generated playlists/)).toBeInTheDocument()
  })

  it('names the HTTP status and offers a retry on failure', async () => {
    const handleReload = vi.fn()
    const user = userEvent.setup()

    render(
      <PlaylistPanel
        status="forbidden"
        playlist={undefined}
        errorStatus={403}
        errorReason={'Insufficient client scope'}
        contextType={'playlist'}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        onReload={handleReload}
      />,
    )

    // A refusal Spotify was never going to grant reads as a sentence, not a
    // status code; the retry is still offered.
    expect(screen.queryByText(/HTTP 403/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Insufficient client scope/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(handleReload).toHaveBeenCalledOnce()
  })

  it('drops focus from a clicked row so keyboard controls keep working', async () => {
    const user = userEvent.setup()

    render(
      <PlaylistPanel
        status="ready"
        playlist={buildPlaylist()}
        currentTrackUri="spotify:track:1"
        onSelectTrack={vi.fn()}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'playlist'}
        onReload={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Second Song'))

    expect(document.activeElement).toBe(document.body)
  })

  it('names what is playing when the context has no track list', () => {
    render(
      <PlaylistPanel
        status="unsupported"
        playlist={undefined}
        errorStatus={undefined}
        errorReason={undefined}
        contextType={'artist'}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/You're playing an artist/)).toBeInTheDocument()
  })

  it("does not call an album's refusal a playlist ownership problem", () => {
    render(
      <PlaylistPanel
        status="forbidden"
        playlist={undefined}
        errorStatus={403}
        errorReason={undefined}
        contextType={'album'}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/wouldn't share this album's tracks/)).toBeInTheDocument()
    expect(screen.queryByText(/own or collaborate on/)).not.toBeInTheDocument()
  })

  it('still shows the status and reason for an unexpected failure', () => {
    render(
      <PlaylistPanel
        status="error"
        playlist={undefined}
        errorStatus={500}
        errorReason={'Server error'}
        contextType={'playlist'}
        currentTrackUri={undefined}
        onSelectTrack={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
    expect(screen.getByText(/Server error/)).toBeInTheDocument()
  })
})
