import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
import { useSpotifyPlayer } from '~/hooks/useSpotifyPlayer'
import { usePlaybackMode } from '~/hooks/usePlaybackMode'
import { useRemotePlayer } from '~/hooks/useRemotePlayer'
import { useSpotifyPlaylist } from '~/hooks/useSpotifyPlaylist'
import { useTabWorkspace, type UseTabWorkspaceResult } from '~/hooks/useTabWorkspace'
import { useUserPlaylists } from '~/hooks/useUserPlaylists'
import type { PlaybackState } from '~/lib/types'
import { Player } from './Player'

vi.mock('~/hooks/useSpotifyPlayer', () => ({
  useSpotifyPlayer: vi.fn(),
}))
vi.mock('~/hooks/useKeyboardControls', () => ({
  useKeyboardControls: vi.fn(),
}))
vi.mock('~/hooks/usePlaybackMode', () => ({
  usePlaybackMode: vi.fn(),
}))
vi.mock('~/hooks/useRemotePlayer', () => ({
  useRemotePlayer: vi.fn(),
}))
vi.mock('~/hooks/useUserPlaylists', () => ({
  useUserPlaylists: vi.fn(() => ({ status: 'ready', playlists: [] })),
}))
vi.mock('~/hooks/usePinnedPlaylists', () => ({
  usePinnedPlaylists: vi.fn(() => ({ pinned: [], togglePin: vi.fn() })),
}))
vi.mock('~/hooks/useTabWorkspace', () => ({
  useTabWorkspace: vi.fn(),
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

const setMode = vi.fn()
const reportLocalPlaybackFailure = vi.fn()

const remoteResult = {
  status: 'idle' as const,
  playbackState: undefined,
  togglePlay: vi.fn(),
  nextTrack: vi.fn(),
  previousTrack: vi.fn(),
  seek: vi.fn(),
  toggleShuffle: vi.fn(),
  playTrack: vi.fn(),
  volume: 50,
  setVolume: vi.fn(),
  devices: [],
  activeDeviceName: undefined,
  selectDevice: vi.fn(),
}

const mockedUsePlaybackMode = vi.mocked(usePlaybackMode)
const mockedUseRemotePlayer = vi.mocked(useRemotePlayer)
const mockedUseSpotifyPlayer = vi.mocked(useSpotifyPlayer)
const mockedUseKeyboardControls = vi.mocked(useKeyboardControls)
const mockedUseSpotifyPlaylist = vi.mocked(useSpotifyPlaylist)
const mockedUseUserPlaylists = vi.mocked(useUserPlaylists)
const mockedUseTabWorkspace = vi.mocked(useTabWorkspace)

const buildWorkspace = (overrides: Partial<UseTabWorkspaceResult> = {}): UseTabWorkspaceResult => ({
  library: {
    status: 'ready',
    tabs: [],
    songs: [],
    addTabFile: vi.fn(),
    linkTab: vi.fn(),
    unlinkTab: vi.fn(),
    removeTab: vi.fn(),
    reload: vi.fn(),
  },
  backup: { status: { kind: 'idle' }, exportLibrary: vi.fn(), importLibrary: vi.fn() },
  tabCountFor: vi.fn(() => 0),
  openTab: undefined,
  pickerSong: undefined,
  isLibraryOpen: false,
  uploadError: undefined,
  openSongTabs: vi.fn(),
  openTabInViewer: vi.fn(),
  closeViewer: vi.fn(),
  openPicker: vi.fn(),
  closePicker: vi.fn(),
  openLibrary: vi.fn(),
  closeLibrary: vi.fn(),
  uploadTab: vi.fn(),
  deleteTab: vi.fn(),
  preview: undefined,
  previewLibraryTab: vi.fn(),
  previewOnlineTab: vi.fn(),
  closePreview: vi.fn(),
  addPreviewed: vi.fn(),
  online: {
    state: { kind: 'idle' },
    search: vi.fn(),
    reset: vi.fn(),
    addingIds: [],
    addedIds: [],
    addOnlineTab: vi.fn(),
  },
  ...overrides,
})

const buildPlaybackState = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  track: {
    id: 'track-1',
    uri: 'spotify:track:track-1',
    linkedFromUri: undefined,
    name: 'Song Title',
    artistNames: ['Artist One', 'Artist Two'],
    albumName: 'Album Name',
    albumImageUrl: 'https://example.com/art.jpg',
    durationMs: 200_000,
  },
  contextUri: undefined,
  positionMs: 30_000,
  isPaused: false,
  isShuffled: false,
  ...overrides,
})

describe('Player', () => {
  beforeEach(() => {
    setMode.mockClear()
    reportLocalPlaybackFailure.mockClear()
    mockedUsePlaybackMode.mockReturnValue({ mode: 'local', setMode, reportLocalPlaybackFailure })
    mockedUseRemotePlayer.mockReturnValue(remoteResult)
    mockedUseTabWorkspace.mockReturnValue(buildWorkspace())
  })

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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Nothing is playing here yet/)).toBeInTheDocument()
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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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
      toggleShuffle: vi.fn(),
      playTrack,
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: 'Playback of protected content is not enabled.',
      isLicenseRefused: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Playback of protected content is not enabled/)).toBeInTheDocument()
  })

  it('explains a refused DRM licence', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: true,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/refused this browser a DRM licence/)).toBeInTheDocument()
  })

  it('keeps the playlist inside the slot that matches the card height', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    // The slot is what lets a long track list scroll instead of stretching
    // the row past the player card.
    const panel = screen.getByRole('complementary', { name: 'Playlist' })
    expect(panel.closest('[class*="panelSlot"]')).not.toBeNull()
  })

  it('loads the playlist for whatever context is playing', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState({ contextUri: 'spotify:playlist:p1' }),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
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

  it('waits for detection before choosing a mode', () => {
    mockedUsePlaybackMode.mockReturnValue({
      mode: undefined,
      setMode,
      reportLocalPlaybackFailure,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/Checking what this browser can play/)).toBeInTheDocument()
  })

  it('leaves the local SDK unconnected while controlling a remote device', () => {
    mockedUsePlaybackMode.mockReturnValue({ mode: 'remote', setMode, reportLocalPlaybackFailure })
    mockedUseRemotePlayer.mockReturnValue({
      ...remoteResult,
      status: 'ready',
      playbackState: buildPlaybackState(),
      activeDeviceName: 'Kitchen speaker',
      devices: [{ id: 'device-1', name: 'Kitchen speaker', isActive: true }],
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    // No token means no SDK device is claimed and no DRM licence is sought.
    expect(mockedUseSpotifyPlayer).toHaveBeenCalledWith(undefined)
    expect(mockedUseRemotePlayer).toHaveBeenCalledWith('token')
    expect(screen.getByDisplayValue('Kitchen speaker')).toBeInTheDocument()
  })

  it('stops polling the Web API while playing in the page', () => {
    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(mockedUseRemotePlayer).toHaveBeenCalledWith(undefined)
    expect(mockedUseSpotifyPlayer).toHaveBeenCalledWith('token')
  })

  it('drives the remote device from the shared controls', async () => {
    const togglePlay = vi.fn()
    mockedUsePlaybackMode.mockReturnValue({ mode: 'remote', setMode, reportLocalPlaybackFailure })
    mockedUseRemotePlayer.mockReturnValue({
      ...remoteResult,
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(togglePlay).toHaveBeenCalledOnce()
  })

  it('asks for a device when none is awake to control', () => {
    mockedUsePlaybackMode.mockReturnValue({ mode: 'remote', setMode, reportLocalPlaybackFailure })
    mockedUseRemotePlayer.mockReturnValue({ ...remoteResult, status: 'no-device' })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(screen.getByText(/No Spotify devices are awake/)).toBeInTheDocument()
  })

  it('remembers a refused licence so the device stops defaulting to local', () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: true,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    expect(reportLocalPlaybackFailure).toHaveBeenCalled()
  })

  it('offers a one-click switch to remote control when the licence is refused', async () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: true,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Switch to remote control' }))
    expect(setMode).toHaveBeenCalledWith('remote')
  })

  it('switches mode from the toggle', async () => {
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: buildPlaybackState(),
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback: vi.fn(),
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Remote' }))
    expect(setMode).toHaveBeenCalledWith('remote')
  })

  it('offers to take playback over when nothing is playing here', async () => {
    const claimPlayback = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback,
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Play here' }))
    expect(claimPlayback).toHaveBeenCalledOnce()
  })

  it('does not take playback over merely by switching to this browser', async () => {
    const claimPlayback = vi.fn()
    mockedUsePlaybackMode.mockReturnValue({ mode: 'remote', setMode, reportLocalPlaybackFailure })
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback,
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })
    mockedUseRemotePlayer.mockReturnValue({ ...remoteResult, status: 'no-device' })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'This browser' }))

    // Choosing where playback *can* happen is not choosing to move it.
    expect(setMode).toHaveBeenCalledWith('local')
    expect(claimPlayback).not.toHaveBeenCalled()
  })

  it('does not take playback over on a plain load in local mode', () => {
    const claimPlayback = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback,
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    // Opening a tab must not yank playback off whatever is playing elsewhere.
    expect(claimPlayback).not.toHaveBeenCalled()
  })

  it('does not take playback over when switching to remote control', async () => {
    const claimPlayback = vi.fn()
    mockedUseSpotifyPlayer.mockReturnValue({
      status: 'ready',
      playbackState: undefined,
      togglePlay: vi.fn(),
      nextTrack: vi.fn(),
      previousTrack: vi.fn(),
      seek: vi.fn(),
      toggleShuffle: vi.fn(),
      playTrack: vi.fn(),
      volume: 50,
      setVolume: vi.fn(),
      claimPlayback,
      playbackErrorMessage: undefined,
      isLicenseRefused: false,
    })
    const user = userEvent.setup()

    render(<Player accessToken="token" onLogout={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Remote' }))

    expect(setMode).toHaveBeenCalledWith('remote')
    expect(claimPlayback).not.toHaveBeenCalled()
  })

  describe('volume and browsing', () => {
    const readyLocal = (overrides: Partial<ReturnType<typeof useSpotifyPlayer>> = {}) => {
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'ready',
        playbackState: buildPlaybackState({ contextUri: 'spotify:playlist:p1' }),
        togglePlay: vi.fn(),
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack: vi.fn(),
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
        ...overrides,
      })
    }

    it('shows shuffle in the transport and binds it to S', async () => {
      const toggleShuffle = vi.fn()
      readyLocal({
        playbackState: buildPlaybackState({ isShuffled: true }),
        toggleShuffle,
      })
      const user = userEvent.setup()

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      const shuffle = screen.getByRole('button', { name: 'Shuffle' })
      expect(shuffle).toHaveAttribute('aria-pressed', 'true')
      await user.click(shuffle)
      expect(toggleShuffle).toHaveBeenCalledOnce()

      mockedUseKeyboardControls.mock.calls.at(-1)![0].onToggleShuffle()
      expect(toggleShuffle).toHaveBeenCalledTimes(2)
    })

    it('shows a volume slider wired to the player', () => {
      const setVolume = vi.fn()
      readyLocal({ volume: 30, setVolume })

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('30')
    })

    it('hides the volume slider when the device has no volume', () => {
      readyLocal({ volume: undefined })

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      expect(screen.queryByRole('slider', { name: 'Volume' })).not.toBeInTheDocument()
    })

    it('registers keyboard controls that step and mute the volume', () => {
      const setVolume = vi.fn()
      readyLocal({ volume: 50, setVolume })

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      const handlers = mockedUseKeyboardControls.mock.calls[0]![0]
      handlers.onVolumeUp()
      expect(setVolume).toHaveBeenLastCalledWith(55)
      handlers.onVolumeDown()
      expect(setVolume).toHaveBeenLastCalledWith(45)
      handlers.onToggleMute()
      expect(setVolume).toHaveBeenLastCalledWith(0)
    })

    it('lists a browsed playlist and starts a track from it', async () => {
      const playTrack = vi.fn()
      readyLocal({ playTrack })
      mockedUseUserPlaylists.mockReturnValue({
        status: 'ready',
        playlists: [{ uri: 'spotify:playlist:focus', name: 'Focus' }],
      })
      mockedUseSpotifyPlaylist.mockImplementation((_token, contextUri) => ({
        status: 'ready',
        playlist:
          contextUri === 'spotify:playlist:focus'
            ? {
                name: 'Focus',
                tracks: [
                  { uri: 'spotify:track:calm', name: 'Calm', artistNames: [], durationMs: 1_000 },
                ],
              }
            : { name: 'My Mix', tracks: [] },
        errorStatus: undefined,
        errorReason: undefined,
        contextType: 'playlist',
        reload: vi.fn(),
      }))
      const user = userEvent.setup()

      render(<Player accessToken="token" onLogout={vi.fn()} />)
      await user.selectOptions(screen.getByRole('combobox', { name: 'Browse' }), 'Focus')
      await user.click(screen.getByText('Calm'))

      expect(playTrack).toHaveBeenCalledWith('spotify:playlist:focus', 'spotify:track:calm')
    })

    it('offers the playlist browser while nothing is playing yet', () => {
      readyLocal({ playbackState: undefined })

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      expect(screen.getByRole('combobox', { name: 'Browse' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Play here' })).toBeInTheDocument()
    })
  })

  describe('tabs', () => {
    const readyWith = (playTrack = vi.fn()) =>
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'ready',
        playbackState: buildPlaybackState(),
        togglePlay: vi.fn(),
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack,
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
      })

    it('adds a tab to the song that is playing', async () => {
      readyWith()
      const workspace = buildWorkspace()
      mockedUseTabWorkspace.mockReturnValue(workspace)
      const user = userEvent.setup()

      render(<Player accessToken="token" onLogout={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Add tab' }))

      expect(workspace.openSongTabs).toHaveBeenCalledWith({
        uri: 'spotify:track:track-1',
        name: 'Song Title',
        artistNames: ['Artist One', 'Artist Two'],
        alternateUris: [],
      })
    })

    it('offers to view the tab of a relinked copy, by the URI the playlist had', () => {
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'ready',
        playbackState: buildPlaybackState({
          track: { ...buildPlaybackState().track, linkedFromUri: 'spotify:track:original' },
        }),
        togglePlay: vi.fn(),
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack: vi.fn(),
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
      })
      mockedUseTabWorkspace.mockReturnValue(
        buildWorkspace({
          tabCountFor: (song) => (song.alternateUris?.includes('spotify:track:original') ? 1 : 0),
        }),
      )

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'View tab' })).toBeInTheDocument()
    })

    it('gives the open tab Spotify’s transport to play along with', async () => {
      const togglePlay = vi.fn()
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'ready',
        playbackState: buildPlaybackState(),
        togglePlay,
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack: vi.fn(),
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
      })
      const tab = {
        id: 'tab-1',
        name: 'Solo',
        fileName: 'Solo.ptb',
        format: 'power-tab' as const,
        sizeBytes: 1,
        addedAt: 1,
      }
      mockedUseTabWorkspace.mockReturnValue(
        buildWorkspace({
          openTab: {
            tabId: tab.id,
            song: undefined,
            tab,
            data: { status: 'ready', data: new ArrayBuffer(1) },
            songTabs: [],
          },
        }),
      )
      const user = userEvent.setup()

      render(<Player accessToken="token" onLogout={vi.fn()} />)
      const spotify = screen.getByRole('group', { name: 'Spotify playback' })
      await user.click(within(spotify).getByRole('button', { name: 'Pause' }))

      // The song is already named in the viewer's title bar.
      expect(spotify).not.toHaveTextContent('Song Title')
      expect(togglePlay).toHaveBeenCalledOnce()
      expect(screen.queryByRole('group', { name: 'Sync with Spotify' })).not.toBeInTheDocument()
    })

    it('opens the library, and plays a song from it on its own', async () => {
      const playTrack = vi.fn()
      readyWith(playTrack)
      const workspace = buildWorkspace({
        isLibraryOpen: true,
        library: {
          ...buildWorkspace().library,
          songs: [{ uri: 'spotify:track:nemo', name: 'Nemo', artistNames: [], tabIds: [] }],
        },
      })
      mockedUseTabWorkspace.mockReturnValue(workspace)
      const user = userEvent.setup()

      render(<Player accessToken="token" onLogout={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Tab library' }))
      await user.click(screen.getByRole('button', { name: 'Play Nemo' }))

      expect(workspace.openLibrary).toHaveBeenCalledOnce()
      expect(playTrack).toHaveBeenCalledWith(undefined, 'spotify:track:nemo')
    })
  })

  describe('layout', () => {
    const renderPlaying = (overrides: Partial<ReturnType<typeof useSpotifyPlayer>> = {}) => {
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'ready',
        playbackState: buildPlaybackState(),
        togglePlay: vi.fn(),
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack: vi.fn(),
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
        ...overrides,
      })
      return render(<Player accessToken="token" onLogout={vi.fn()} />)
    }

    const nowPlayingCard = () => screen.getByRole('region', { name: 'Now playing' })

    it('keeps the now-playing card to what is playing and its tab', () => {
      renderPlaying()
      const card = nowPlayingCard()

      expect(within(card).getByText('Song Title')).toBeInTheDocument()
      expect(within(card).getByRole('progressbar')).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
      expect(within(card).getByRole('slider', { name: 'Volume' })).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Add tab' })).toBeInTheDocument()
      expect(within(card).getAllByRole('button')).toHaveLength(6)
    })

    it('puts the mode, the library and logging out in the bar', () => {
      renderPlaying()
      const bar = screen.getByRole('banner')

      expect(within(bar).getByRole('button', { name: 'Tab library' })).toBeInTheDocument()
      expect(within(bar).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
      expect(within(nowPlayingCard()).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
      expect(within(nowPlayingCard()).queryByText(/Space play\/pause/)).not.toBeInTheDocument()
    })

    it('shows playback trouble outside the card', () => {
      renderPlaying({ playbackErrorMessage: 'Protected content is off.' })

      const notice = screen.getByText(/Protected content is off/)
      expect(nowPlayingCard()).not.toContainElement(notice)
    })

    it('keeps the device picker in the bar in remote mode', () => {
      mockedUsePlaybackMode.mockReturnValue({ mode: 'remote', setMode, reportLocalPlaybackFailure })
      mockedUseSpotifyPlayer.mockReturnValue({
        status: 'idle',
        playbackState: undefined,
        togglePlay: vi.fn(),
        nextTrack: vi.fn(),
        previousTrack: vi.fn(),
        seek: vi.fn(),
        toggleShuffle: vi.fn(),
        playTrack: vi.fn(),
        volume: 50,
        setVolume: vi.fn(),
        claimPlayback: vi.fn(),
        playbackErrorMessage: undefined,
        isLicenseRefused: false,
      })
      mockedUseRemotePlayer.mockReturnValue({
        ...remoteResult,
        status: 'ready',
        playbackState: buildPlaybackState(),
        devices: [{ id: 'device-1', name: 'Kitchen speaker', isActive: true }],
        activeDeviceName: 'Kitchen speaker',
        toggleShuffle: vi.fn(),
        volume: 40,
        setVolume: vi.fn(),
      })

      render(<Player accessToken="token" onLogout={vi.fn()} />)

      expect(within(screen.getByRole('banner')).getByDisplayValue('Kitchen speaker')).toBeInTheDocument()
      expect(within(nowPlayingCard()).queryByDisplayValue('Kitchen speaker')).not.toBeInTheDocument()
    })
  })
})
