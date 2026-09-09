import { memo, useEffect, useRef } from 'react'
import type { SpotifyPlaylistStatus } from '~/hooks/useSpotifyPlaylist'
import { formatTime } from '~/lib/formatTime'
import type { Playlist } from '~/lib/types'
import styles from './PlaylistPanel.module.scss'

type PlaylistPanelProps = {
  status: SpotifyPlaylistStatus
  playlist: Playlist | undefined
  errorStatus: number | undefined
  errorReason: string | undefined
  currentTrackUri: string | undefined
  onSelectTrack: (trackUri: string) => void
  onReload: () => void
}

const MESSAGES: Record<SpotifyPlaylistStatus, string> = {
  empty: 'Play a playlist to see its tracks here.',
  unsupported: 'The current track is not playing from a playlist or album.',
  loading: 'Loading tracks…',
  expired: 'Your Spotify session expired. It will retry after the token refreshes.',
  forbidden:
    'Spotify only returns the tracks of playlists you own or collaborate on. Check the console for the exact reason.',
  inaccessible:
    'Spotify hides its own generated playlists (Daily Mix, Discover Weekly, editorial) from apps.',
  error: 'Could not load the tracks for what is playing.',
  ready: 'Loading tracks…',
}

const FAILED_STATUSES: SpotifyPlaylistStatus[] = [
  'expired',
  'forbidden',
  'inaccessible',
  'error',
]

/**
 * Memoised because the progress bar re-renders the player several times a
 * second, and re-rendering a full playlist that often starves the main thread
 * that the playback SDK needs.
 */
const PlaylistPanelComponent = ({
  status,
  playlist,
  errorStatus,
  errorReason,
  currentTrackUri,
  onSelectTrack,
  onReload,
}: PlaylistPanelProps) => {
  const currentTrackRef = useRef<HTMLLIElement>(null)

  // Long playlists scroll, so follow along as playback moves.
  useEffect(() => {
    currentTrackRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentTrackUri, playlist])

  return (
    <aside className={styles.panel} aria-label="Playlist">
      <div className={styles.header}>
        <h2 className={styles.title}>{playlist?.name ?? 'Playlist'}</h2>
        {playlist && <span className={styles.count}>{playlist.tracks.length} tracks</span>}
      </div>
      {status !== 'ready' || !playlist ? (
        <div className={styles.notice}>
          <p className={styles.message}>
            {MESSAGES[status]}
            {errorStatus !== undefined && ` (HTTP ${errorStatus})`}
          </p>
          {errorReason && <p className={styles.reason}>Spotify said: “{errorReason}”</p>}
          {FAILED_STATUSES.includes(status) && (
            <button type="button" className={styles.retry} onClick={onReload}>
              Try again
            </button>
          )}
        </div>
      ) : (
        <ol className={styles.tracks}>
          {playlist.tracks.map((track, index) => {
            const isCurrent = track.uri === currentTrackUri

            return (
              <li key={`${track.uri}-${index}`} ref={isCurrent ? currentTrackRef : undefined}>
                <button
                  type="button"
                  className={styles.track}
                  aria-current={isCurrent || undefined}
                  onClick={(event) => {
                    // Leaving focus on the row would let Space and the arrow
                    // keys act on it instead of on playback.
                    event.currentTarget.blur()
                    onSelectTrack(track.uri)
                  }}
                >
                  <span className={styles.index}>{isCurrent ? '▶' : index + 1}</span>
                  <span className={styles.trackText}>
                    <span className={styles.trackName}>{track.name}</span>
                    <span className={styles.artistNames}>{track.artistNames.join(', ')}</span>
                  </span>
                  <span className={styles.duration}>{formatTime(track.durationMs)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}

export const PlaylistPanel = memo(PlaylistPanelComponent)
