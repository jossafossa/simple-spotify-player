import { useCallback } from 'react'
import { Card } from '~/components/Card'
import { Controls } from '~/components/Controls'
import { PlaylistPanel } from '~/components/PlaylistPanel'
import { ProgressBar } from '~/components/ProgressBar'
import { useKeyboardControls } from '~/hooks/useKeyboardControls'
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
  const { status, playbackState, togglePlay, nextTrack, previousTrack, seek, playTrack } =
    useSpotifyPlayer(accessToken)
  const positionMs = useTickingPosition(playbackState)
  const contextUri = playbackState?.contextUri
  const { status: playlistStatus, playlist } = useSpotifyPlaylist(accessToken, contextUri)

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

  const logoutButton = (
    <button type="button" className={styles.logout} onClick={onLogout}>
      Log out
    </button>
  )

  if (status === 'connecting') {
    return (
      <Card>
        <p className={styles.message}>Connecting to Spotify…</p>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <p className={styles.message}>
          Something went wrong. Check that you have Spotify Premium and that
          your Spotify app's Redirect URI is set up correctly.
        </p>
        {logoutButton}
      </Card>
    )
  }

  if (!playbackState) {
    return (
      <Card>
        <p className={styles.message}>
          Connected. Open Spotify and switch playback to "Spotify Player
          (web)" to start.
        </p>
        {logoutButton}
      </Card>
    )
  }

  return (
    <div className={styles.layout}>
      <Card>
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
        {status === 'offline' && (
          <p className={styles.message}>This device went offline — reconnecting…</p>
        )}
        <p className={styles.hint}>
          Space to play/pause · ← → to seek · N next · P previous
        </p>
        {logoutButton}
      </Card>
      <PlaylistPanel
        status={playlistStatus}
        playlist={playlist}
        currentTrackUri={playbackState.track.uri}
        onSelectTrack={handleSelectTrack}
      />
    </div>
  )
}
