import { memo } from 'react'
import type { PlaylistSummary } from '~/lib/types'
import styles from './PlaylistBrowser.module.scss'

type PlaylistBrowserProps = {
  playlists: PlaylistSummary[]
  isLoading: boolean
  pinned: PlaylistSummary[]
  /** Undefined while the panel follows whatever is playing. */
  selectedUri: string | undefined
  onSelect: (playlistUri: string | undefined) => void
  onTogglePin: (playlist: PlaylistSummary) => void
}

const FOLLOW_PLAYBACK = ''

/**
 * Memoised for the same reason as the playlist panel: the player re-renders
 * several times a second while the progress bar ticks.
 */
const PlaylistBrowserComponent = ({
  playlists,
  isLoading,
  pinned,
  selectedUri,
  onSelect,
  onTogglePin,
}: PlaylistBrowserProps) => {
  const selected =
    playlists.find((playlist) => playlist.uri === selectedUri) ??
    pinned.find((playlist) => playlist.uri === selectedUri)
  const isSelectedPinned = pinned.some((playlist) => playlist.uri === selectedUri)
  // A pinned playlist the listing no longer has still needs an option, or the
  // select would silently show something else while it is open.
  const isMissingFromListing =
    selected && !playlists.some((playlist) => playlist.uri === selected.uri)

  return (
    <div className={styles.browser}>
      {pinned.length > 0 && (
        <nav className={styles.pins} aria-label="Pinned playlists">
          {pinned.map((playlist) => (
            <button
              key={playlist.uri}
              type="button"
              className={styles.pin}
              aria-current={playlist.uri === selectedUri || undefined}
              onClick={(event) => {
                event.currentTarget.blur()
                onSelect(playlist.uri)
              }}
            >
              {playlist.name}
            </button>
          ))}
        </nav>
      )}
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Browse</span>
          <select
            className={styles.select}
            value={selectedUri ?? FOLLOW_PLAYBACK}
            onChange={(event) => {
              onSelect(event.target.value || undefined)
              // Hand the arrow keys back to volume once a choice is made.
              event.currentTarget.blur()
            }}
          >
            <option value={FOLLOW_PLAYBACK}>Now playing</option>
            {isMissingFromListing && <option value={selected.uri}>{selected.name}</option>}
            {isLoading && playlists.length === 0 && (
              <option disabled>Loading your playlists…</option>
            )}
            {playlists.map((playlist) => (
              <option key={playlist.uri} value={playlist.uri}>
                {playlist.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.pinToggle}
          disabled={!selected}
          aria-pressed={isSelectedPinned}
          aria-label={isSelectedPinned ? 'Unpin playlist' : 'Pin playlist'}
          title={isSelectedPinned ? 'Unpin playlist' : 'Pin playlist'}
          onClick={(event) => {
            event.currentTarget.blur()
            if (selected) {
              onTogglePin(selected)
            }
          }}
        >
          {isSelectedPinned ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}

export const PlaylistBrowser = memo(PlaylistBrowserComponent)
