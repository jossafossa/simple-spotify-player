import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DeviceSelect } from '~/components/feature/DeviceSelect'
import { ModeToggle } from '~/components/feature/ModeToggle'
import { PlaylistBrowser } from '~/components/feature/PlaylistBrowser'
import { PlaylistPanel } from '~/components/feature/PlaylistPanel'
import { TabDialogs, TabViewerSlot } from '~/components/feature/TabWorkspace'
import { AppBar } from '~/components/ui/AppBar'
import { Card } from '~/components/ui/Card'
import { Controls } from '~/components/ui/Controls'
import { ProgressBar } from '~/components/ui/ProgressBar'
import { VolumeControl } from '~/components/ui/VolumeControl'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
import { usePinnedPlaylists } from '~/hooks/usePinnedPlaylists'
import { usePlaybackMode } from '~/hooks/usePlaybackMode'
import { useRemotePlayer } from '~/hooks/useRemotePlayer'
import { useSpotifyPlayer } from '~/hooks/useSpotifyPlayer'
import { useSpotifyPlaylist } from '~/hooks/useSpotifyPlaylist'
import { useTabFollowsPlayback } from '~/hooks/useTabFollowsPlayback'
import { useTabWorkspace } from '~/hooks/useTabWorkspace'
import { useTickingPosition } from '~/hooks/useTickingPosition'
import { useUserPlaylists } from '~/hooks/useUserPlaylists'
import { useVolumeControl } from '~/hooks/useVolumeControl'
import { fetchTrackTempo } from '~/lib/spotifyApi'
import type { PlaybackTrack, SongRef } from '~/lib/types'
import styles from './Player.module.scss'

type PlayerProps = {
  accessToken: string
  onLogout: () => void
}

/** The playing track as the tab library knows songs, under both its URIs. */
const songOf = (track: PlaybackTrack): SongRef => ({
  uri: track.uri,
  name: track.name,
  artistNames: track.artistNames,
  alternateUris: track.linkedFromUri ? [track.linkedFromUri] : [],
})

const SEEK_STEP_MS = 5_000
/** Past this far into a song, previous starts it over, as most players do. */
const RESTART_WINDOW_MS = 3_000
const VOLUME_STEP_PERCENT = 5

export const Player = ({ accessToken, onLogout }: PlayerProps) => {
  const { mode, setMode, reportLocalPlaybackFailure } = usePlaybackMode()

  // Both hooks always run, and the inactive one is switched off by being
  // given no token — so no SDK device is claimed while controlling a remote
  // one, and no polling happens while playing here.
  const local = useSpotifyPlayer(mode === 'local' ? accessToken : undefined)
  const remote = useRemotePlayer(mode === 'remote' ? accessToken : undefined)

  const isRemote = mode === 'remote'
  const player = isRemote ? remote : local
  const {
    playbackState,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    toggleShuffle,
    playTrack,
    volume,
    setVolume,
  } = player
  const { isMuted, changeVolumeBy, toggleMute } = useVolumeControl(volume, setVolume)

  const positionMs = useTickingPosition(playbackState)
  const contextUri = playbackState?.contextUri

  // Undefined means the panel follows playback; picking a playlist pins the
  // panel to it until "Now playing" is picked again.
  const [browsedUri, setBrowsedUri] = useState<string>()
  const shownUri = browsedUri ?? contextUri
  const { status: userPlaylistsStatus, playlists: userPlaylists } = useUserPlaylists(accessToken)
  const { pinned, togglePin } = usePinnedPlaylists()
  const tabs = useTabWorkspace()
  const { openSongTabs } = tabs
  const {
    status: playlistStatus,
    playlist,
    errorStatus: playlistErrorStatus,
    errorReason: playlistErrorReason,
    contextType: playlistContextType,
    reload: reloadPlaylist,
  } = useSpotifyPlaylist(accessToken, shownUri)

  // Taking playback off another device is always its own decision, never a
  // side effect of choosing a mode: switching to this browser readies the
  // device, and "Play here" is what actually moves the music across.
  const { claimPlayback } = local

  // A refused licence means this browser cannot stream at all, so remember it
  // and let the device default to remote control from now on.
  useEffect(() => {
    if (local.isLicenseRefused) {
      reportLocalPlaybackFailure()
    }
  }, [local.isLicenseRefused, reportLocalPlaybackFailure])

  const seekBy = (deltaMs: number) => {
    if (!playbackState) {
      return
    }

    const nextPositionMs = Math.min(
      Math.max(positionMs + deltaMs, 0),
      playbackState.track.durationMs,
    )
    seek(nextPositionMs)
  }

  const restartOrPrevious = () => {
    if (positionMs > RESTART_WINDOW_MS) {
      seek(0)
      return
    }

    previousTrack()
  }

  useKeyboardControls({
    onTogglePlay: togglePlay,
    onNext: nextTrack,
    onPrevious: restartOrPrevious,
    onSeekBackward: () => seekBy(-SEEK_STEP_MS),
    onSeekForward: () => seekBy(SEEK_STEP_MS),
    onVolumeUp: () => changeVolumeBy(VOLUME_STEP_PERCENT),
    onVolumeDown: () => changeVolumeBy(-VOLUME_STEP_PERCENT),
    onToggleMute: toggleMute,
    onToggleShuffle: toggleShuffle,
  })

  // Kept stable so ticking the progress bar does not re-render the playlist.
  const handleSelectTrack = useCallback(
    (trackUri: string) => {
      if (shownUri) {
        playTrack(shownUri, trackUri)
      }
    },
    [shownUri, playTrack],
  )

  const nowPlayingSong = playbackState && songOf(playbackState.track)
  const nowPlayingTabCount = nowPlayingSong ? tabs.tabCountFor(nowPlayingSong) : 0

  useTabFollowsPlayback({
    playingSong: nowPlayingSong,
    openSong: tabs.openTab?.song,
    // A preview is for choosing a tab for one song; it stays open.
    isViewerOpen: !!tabs.openTab && !tabs.preview,
    showTabFor: tabs.showTabFor,
  })

  const tabButton = nowPlayingSong && (
    <button
      type="button"
      className={nowPlayingTabCount > 0 ? styles.tabAction : styles.tabActionQuiet}
      onClick={(event) => {
        event.currentTarget.blur()
        openSongTabs(nowPlayingSong)
      }}
    >
      {nowPlayingTabCount > 0 ? 'View tab' : 'Add tab'}
    </button>
  )

  const tabDialogs = (
    <TabDialogs workspace={tabs} onPlaySong={(song) => playTrack(undefined, song.uri)} />
  )

  const playlistColumn = (
    <div className={styles.panelSlot}>
      <div className={styles.panelColumn}>
        <PlaylistBrowser
          playlists={userPlaylists}
          isLoading={userPlaylistsStatus === 'loading'}
          pinned={pinned}
          selectedUri={browsedUri}
          onSelect={setBrowsedUri}
          onTogglePin={togglePin}
        />
        <div className={styles.panelFill}>
          <PlaylistPanel
            status={playlistStatus}
            playlist={playlist}
            errorStatus={playlistErrorStatus}
            errorReason={playlistErrorReason}
            contextType={playlistContextType}
            currentTrackUri={playbackState?.track.uri}
            onSelectTrack={handleSelectTrack}
            onReload={reloadPlaylist}
            tabCountFor={tabs.tabCountFor}
            onOpenTrackTabs={openSongTabs}
          />
        </div>
      </div>
    </div>
  )

  const appBar = (
    <AppBar
      start={
        <>
          {mode && (
            <div className={styles.modeSlot}>
              <ModeToggle mode={mode} onChange={setMode} />
            </div>
          )}
          {isRemote && player.status !== 'connecting' && (
            <DeviceSelect
              devices={remote.devices}
              activeDeviceName={remote.activeDeviceName}
              onSelect={remote.selectDevice}
              isInline
            />
          )}
        </>
      }
      end={
        <>
          <button
            type="button"
            className={styles.barAction}
            onClick={(event) => {
              event.currentTarget.blur()
              tabs.openLibrary()
            }}
          >
            Tab library
          </button>
          <button type="button" className={styles.logout} onClick={onLogout}>
            Log out
          </button>
        </>
      }
    />
  )

  const notices = !isRemote &&
    (local.status === 'offline' || local.playbackErrorMessage || local.isLicenseRefused) && (
      <div className={styles.notices} role="status">
        {local.status === 'offline' && (
          <p className={styles.notice}>This device went offline — reconnecting…</p>
        )}
        {local.playbackErrorMessage && (
          <p className={styles.playbackError}>
            Spotify could not play this track: {local.playbackErrorMessage}
          </p>
        )}
        {local.isLicenseRefused && (
          <div className={styles.playbackError}>
            <p className={styles.stallText}>
              Spotify refused this browser a DRM licence, so playback will stop a few seconds in.
              Firefox forks such as Zen ship Widevine unlicensed. Play in Firefox itself, Chrome or
              Edge, or control another device from here.
            </p>
            <button type="button" className={styles.switchMode} onClick={() => setMode('remote')}>
              Switch to remote control
            </button>
          </div>
        )}
      </div>
    )

  /** Everything around the content: the bar, notices, the shortcuts, the tab view and dialogs. */
  const loadSongBpm = (song: SongRef) => fetchTrackTempo(accessToken, song.uri)

  const shell = (
    content: ReactNode,
    viewer: ReactNode = <TabViewerSlot workspace={tabs} loadSongBpm={loadSongBpm} />,
  ) => (
    <div className={styles.screen}>
      {appBar}
      {notices}
      {content}
      <p className={styles.legend}>
        Space play/pause · ← → seek · ↑ ↓ volume · M mute · S shuffle · N next · P previous
      </p>
      {viewer}
      {tabDialogs}
    </div>
  )

  if (!mode) {
    return (
      <Card>
        <p className={styles.message}>Checking what this browser can play…</p>
      </Card>
    )
  }

  if (player.status === 'connecting') {
    return shell(
      <Card>
        <p className={styles.message}>
          {isRemote ? 'Looking for your Spotify devices…' : 'Connecting to Spotify…'}
        </p>
      </Card>,
    )
  }

  if (player.status === 'error') {
    return shell(
      <Card>
        <p className={styles.message}>
          {isRemote
            ? 'Could not reach Spotify to see what is playing. Check the console for details.'
            : "Something went wrong. Check that you have Spotify Premium and that your Spotify app's Redirect URI is set up correctly."}
        </p>
      </Card>,
    )
  }

  if (!playbackState) {
    return shell(
      <div className={styles.layout}>
        <Card label="Now playing">
          <p className={styles.eyebrow}>Now playing</p>
          {isRemote ? (
            <p className={styles.message}>
              Nothing yet. Start something playing in Spotify and it will show up here.
            </p>
          ) : (
            <>
              <p className={styles.message}>
                Connected as "Spotify Player (web)". Nothing is playing here yet.
              </p>
              <button type="button" className={styles.claim} onClick={claimPlayback}>
                Play here
              </button>
              <p className={styles.hint}>Moves playback off whichever device holds it right now.</p>
            </>
          )}
        </Card>
        {playlistColumn}
      </div>,
    )
  }

  return shell(
    <div className={styles.layout}>
      <Card label="Now playing">
        <img
          className={styles.artwork}
          src={playbackState.track.albumImageUrl}
          alt={playbackState.track.albumName}
        />
        <div className={styles.trackInfo}>
          <div className={styles.trackHeading}>
            <p className={styles.eyebrow}>Now playing</p>
            {tabButton}
          </div>
          <p className={styles.trackName}>{playbackState.track.name}</p>
          <p className={styles.artistNames}>{playbackState.track.artistNames.join(', ')}</p>
        </div>
        <ProgressBar
          positionMs={positionMs}
          durationMs={playbackState.track.durationMs}
          onSeek={seek}
        />
        <Controls
          isPaused={playbackState.isPaused}
          onTogglePlay={togglePlay}
          onNext={nextTrack}
          onPrevious={restartOrPrevious}
          isShuffled={playbackState.isShuffled}
          onToggleShuffle={toggleShuffle}
        />
        {volume !== undefined && (
          <VolumeControl
            volumePercent={volume}
            isMuted={isMuted}
            onChange={setVolume}
            onToggleMute={toggleMute}
          />
        )}
      </Card>
      {playlistColumn}
    </div>,
    <TabViewerSlot
      workspace={tabs}
      loadSongBpm={loadSongBpm}
      spotifyPlayback={{
        track: songOf(playbackState.track),
        positionMs,
        isPaused: playbackState.isPaused,
        togglePlay,
        next: nextTrack,
        previous: restartOrPrevious,
      }}
    />,
  )
}
