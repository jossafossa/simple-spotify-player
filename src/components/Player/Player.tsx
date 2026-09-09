import { useCallback, useEffect } from 'react'
import { Card } from '~/components/Card'
import { Controls } from '~/components/Controls'
import { DeviceSelect } from '~/components/DeviceSelect'
import { ModeToggle } from '~/components/ModeToggle'
import { PlaylistPanel } from '~/components/PlaylistPanel'
import { ProgressBar } from '~/components/ProgressBar'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
import { usePlaybackMode } from '~/hooks/usePlaybackMode'
import { useRemotePlayer } from '~/hooks/useRemotePlayer'
import { useSpotifyPlayer } from '~/hooks/useSpotifyPlayer'
import { useSpotifyPlaylist } from '~/hooks/useSpotifyPlaylist'
import { useTickingPosition } from '~/hooks/useTickingPosition'
import styles from './Player.module.scss'

type PlayerProps = {
  accessToken: string
  onLogout: () => void
}

const SEEK_STEP_MS = 5_000

export const Player = ({ accessToken, onLogout }: PlayerProps) => {
  const { mode, setMode, reportLocalPlaybackFailure } = usePlaybackMode()

  // Both hooks always run, and the inactive one is switched off by being
  // given no token — so no SDK device is claimed while controlling a remote
  // one, and no polling happens while playing here.
  const local = useSpotifyPlayer(mode === 'local' ? accessToken : undefined)
  const remote = useRemotePlayer(mode === 'remote' ? accessToken : undefined)

  const isRemote = mode === 'remote'
  const player = isRemote ? remote : local
  const { playbackState, togglePlay, nextTrack, previousTrack, seek, playTrack } = player

  const positionMs = useTickingPosition(playbackState)
  const contextUri = playbackState?.contextUri
  const {
    status: playlistStatus,
    playlist,
    errorStatus: playlistErrorStatus,
    errorReason: playlistErrorReason,
    contextType: playlistContextType,
    reload: reloadPlaylist,
  } = useSpotifyPlaylist(accessToken, contextUri)

  // Taking playback off another device is always its own decision, never a
  // side effect of choosing a mode: switching to this browser readies the
  // device, and "Play here" is what actually moves the music across.
  const { claimPlayback } = local

  // A stall means this browser cannot actually stream, so remember it and let
  // the device default to remote control from now on.
  useEffect(() => {
    if (local.isStalled) {
      reportLocalPlaybackFailure()
    }
  }, [local.isStalled, reportLocalPlaybackFailure])

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

  useKeyboardControls({
    onTogglePlay: togglePlay,
    onNext: nextTrack,
    onPrevious: previousTrack,
    onSeekBackward: () => seekBy(-SEEK_STEP_MS),
    onSeekForward: () => seekBy(SEEK_STEP_MS),
  })

  // Kept stable so ticking the progress bar does not re-render the playlist.
  const handleSelectTrack = useCallback(
    (trackUri: string) => {
      if (contextUri) {
        playTrack(contextUri, trackUri)
      }
    },
    [contextUri, playTrack],
  )

  const modeToggle = mode && <ModeToggle mode={mode} onChange={setMode} />

  const logoutButton = (
    <button type="button" className={styles.logout} onClick={onLogout}>
      Log out
    </button>
  )

  if (!mode) {
    return (
      <Card>
        <p className={styles.message}>Checking what this browser can play…</p>
      </Card>
    )
  }

  if (player.status === 'connecting') {
    return (
      <Card>
        {modeToggle}
        <p className={styles.message}>
          {isRemote ? 'Looking for your Spotify devices…' : 'Connecting to Spotify…'}
        </p>
        {logoutButton}
      </Card>
    )
  }

  if (player.status === 'error') {
    return (
      <Card>
        {modeToggle}
        <p className={styles.message}>
          {isRemote
            ? 'Could not reach Spotify to see what is playing. Check the console for details.'
            : "Something went wrong. Check that you have Spotify Premium and that your Spotify app's Redirect URI is set up correctly."}
        </p>
        {logoutButton}
      </Card>
    )
  }

  if (!playbackState) {
    return (
      <Card>
        {modeToggle}
        {isRemote ? (
          <>
            <DeviceSelect
              devices={remote.devices}
              activeDeviceName={remote.activeDeviceName}
              onSelect={remote.selectDevice}
            />
            <p className={styles.message}>
              Start something playing in Spotify and it will show up here.
            </p>
          </>
        ) : (
          <>
            <p className={styles.message}>
              Connected as "Spotify Player (web)". Nothing is playing here yet.
            </p>
            <button type="button" className={styles.claim} onClick={claimPlayback}>
              Play here
            </button>
            <p className={styles.hint}>
              Moves playback off whichever device holds it right now.
            </p>
          </>
        )}
        {logoutButton}
      </Card>
    )
  }

  return (
    <div className={styles.layout}>
      <Card>
        {modeToggle}
        <img
          className={styles.artwork}
          src={playbackState.track.albumImageUrl}
          alt={playbackState.track.albumName}
        />
        <div className={styles.trackInfo}>
          <p className={styles.trackName}>{playbackState.track.name}</p>
          <p className={styles.artistNames}>
            {playbackState.track.artistNames.join(', ')}
          </p>
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
          onPrevious={previousTrack}
        />
        {isRemote && (
          <DeviceSelect
            devices={remote.devices}
            activeDeviceName={remote.activeDeviceName}
            onSelect={remote.selectDevice}
          />
        )}
        {!isRemote && local.status === 'offline' && (
          <p className={styles.message}>This device went offline — reconnecting…</p>
        )}
        {!isRemote && local.playbackErrorMessage && (
          <p className={styles.playbackError}>
            Spotify could not play this track: {local.playbackErrorMessage}
          </p>
        )}
        {!isRemote && local.isStalled && (
          <div className={styles.playbackError}>
            <p className={styles.stallText}>
              Playback stalled. Spotify streams through Widevine DRM, and this
              browser cannot get a licence — Firefox forks such as Zen ship the
              plugin unlicensed. Play in Firefox itself, Chrome or Edge, or
              control another device from here.
            </p>
            <button type="button" className={styles.switchMode} onClick={() => setMode('remote')}>
              Switch to remote control
            </button>
          </div>
        )}
        <p className={styles.hint}>
          Space to play/pause · ← → to seek · N next · P previous
        </p>
        {logoutButton}
      </Card>
      <div className={styles.panelSlot}>
        <PlaylistPanel
          status={playlistStatus}
          playlist={playlist}
          errorStatus={playlistErrorStatus}
          errorReason={playlistErrorReason}
          contextType={playlistContextType}
          currentTrackUri={playbackState.track.uri}
          onSelectTrack={handleSelectTrack}
          onReload={reloadPlaylist}
        />
      </div>
    </div>
  )
}
