import { memo, useEffect, useRef } from 'react'
import { formatTime } from '~/lib/formatTime'
import type { Playlist, PlaylistStatus } from '~/lib/types'
import styles from './PlaylistPanel.module.scss'

type PlaylistPanelProps = {
  status: PlaylistStatus
  playlist: Playlist | undefined
  errorStatus: number | undefined
  errorReason: string | undefined
  contextType: string | undefined
  currentTrackUri: string | undefined
  onSelectTrack: (trackUri: string) => void
  onReload: () => void
}

/** How to name a playback context in a sentence. */
const CONTEXT_NAMES: Record<string, string> = {
  playlist: 'a playlist',
  album: 'an album',
  artist: 'an artist',
  collection: 'your Liked Songs',
  show: 'a podcast',
  episode: 'a podcast episode',
  track: 'a single track',
}

const describeContext = (contextType: string | undefined): string =>
  (contextType && CONTEXT_NAMES[contextType]) ?? 'something else'

const buildMessage = (status: PlaylistStatus, contextType: string | undefined): string => {
  switch (status) {
    case 'empty':
      return 'Play a playlist or album to see its tracks here.'
    case 'unsupported':
      return `You're playing ${describeContext(contextType)}, which has no track list to jump around.`
    case 'expired':
      return 'Your Spotify session expired. It will retry once the token refreshes.'
    case 'forbidden':
      return contextType === 'album'
        ? "Spotify wouldn't share this album's tracks."
        : "Spotify wouldn't share this playlist's tracks — it only shares playlists you own or collaborate on."
    case 'inaccessible':
      return 'Spotify hides its own generated playlists (Daily Mix, Discover Weekly, editorial) from apps.'
    case 'error':
      return 'Could not load the tracks for what is playing.'
    default:
      return 'Loading tracks…'
  }
}

/** Failures worth offering a retry for. */
const RETRYABLE_STATUSES: PlaylistStatus[] = ['expired', 'forbidden', 'inaccessible', 'error']

/**
 * Spotify refusing a context it was never going to share is expected, so those
 * read as plain sentences; only a genuine surprise is worth an HTTP status.
 */
const UNEXPECTED_STATUSES: PlaylistStatus[] = ['expired', 'error']

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
  contextType,
  currentTrackUri,
  onSelectTrack,
  onReload,
}: PlaylistPanelProps) => {
  const currentTrackRef = useRef<HTMLLIElement>(null)
  const isUnexpected = UNEXPECTED_STATUSES.includes(status)

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
            {buildMessage(status, contextType)}
            {isUnexpected && errorStatus !== undefined && ` (HTTP ${errorStatus})`}
          </p>
          {isUnexpected && errorReason && (
            <p className={styles.reason}>Spotify said: “{errorReason}”</p>
          )}
          {RETRYABLE_STATUSES.includes(status) && (
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
