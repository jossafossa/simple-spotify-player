import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAlphaTab } from '~/hooks/useAlphaTab'
import { useFullPageView } from '~/hooks/useFullPageView'
import { useTabSync } from '~/hooks/useTabSync'
import type { TabDataStatus } from '~/hooks/useTabData'
import { isSameSong } from '~/lib/songMatch'
import { readTabSettings, saveTabSettings } from '~/lib/tabSettingsStorage'
import { isRenderableFormat } from '~/lib/tabFormat'
import type { SongRef, TabFile } from '~/lib/types'
import styles from './TabViewer.module.scss'

type TabViewerProps = {
  tab: TabFile
  data: ArrayBuffer | undefined
  dataStatus: TabDataStatus
  /** The song the tab was opened for, if any. */
  song: SongRef | undefined
  /** All tabs on that song, to switch between them. */
  songTabs: TabFile[]
  /** Spotify's own transport, so the song can be played along with. */
  playbackControls?: ReactNode
  /** Where Spotify is in its song, for the cursor to follow when sync is on. */
  spotifyPlayback?: SpotifyPlayback
  /** Set while the tab is only being previewed, not yet on the song. */
  preview?: { onAdd: () => void; isAdding: boolean }
  onSelectTab: (tabId: string) => void
  onManage: (() => void) | undefined
  onClose: () => void
}

export type SpotifyPlayback = {
  track: SongRef
  positionMs: number
  isPaused: boolean
}

const SYNC_NUDGE_MS = 500

const formatOffset = (offsetMs: number): string =>
  `${offsetMs > 0 ? '+' : offsetMs < 0 ? '−' : '±'}${(Math.abs(offsetMs) / 1000).toFixed(1)} s`

const downloadTab = (tab: TabFile, data: ArrayBuffer) => {
  const url = URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.download = tab.fileName
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * The open tab as a full-page view: the notation fills the screen, every
 * control sits in a bar along the bottom, and the top bar leads back to the
 * player. The tab plays through alphaTab's synthesizer, apart from Spotify.
 *
 * The one feature component besides Player that reaches for hooks: alphaTab
 * is an imperative widget that has to own its DOM node.
 */
export const TabViewer = ({
  tab,
  data,
  dataStatus,
  song,
  songTabs,
  playbackControls,
  spotifyPlayback,
  preview,
  onSelectTab,
  onManage,
  onClose,
}: TabViewerProps) => {
  const isRenderable = isRenderableFormat(tab.format)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  // The sync below needs alphaTab, and alphaTab reports clicks to the sync,
  // so the click is relayed through a ref set once the sync exists.
  const alignToRef = useRef<(tabTimeMs: number) => void>(() => {})
  const alphaTab = useAlphaTab({ container, scrollElement }, isRenderable ? data : undefined, {
    onBeatClick: (tabTimeMs) => alignToRef.current(tabTimeMs),
    initialTrackIndex: readTabSettings(tab.id).trackIndex,
    onTrackSelect: (trackIndex) => saveTabSettings(tab.id, { trackIndex }),
  })
  useFullPageView(onClose)
  const sync = useTabSync({
    tabId: tab.id,
    positionMs: spotifyPlayback?.positionMs,
    canSeek: isRenderable && alphaTab.status === 'ready' && alphaTab.isPlayerReady,
    seekTo: alphaTab.seekTo,
  })
  useEffect(() => {
    alignToRef.current = sync.alignTo
  })
  const isFollowing = sync.isEnabled && !!spotifyPlayback
  const isOtherSong = isFollowing && !!song && !isSameSong(song, spotifyPlayback.track)

  const notice = (() => {
    if (dataStatus === 'loading') {
      return 'Opening the file…'
    }

    if (dataStatus === 'missing') {
      return 'This tab file could not be read from the library.'
    }

    if (dataStatus === 'error') {
      return preview
        ? 'This tab could not be downloaded to preview. Try again, or open it on its site.'
        : 'This tab file could not be read from the library.'
    }

    if (!isRenderable) {
      return 'Power Tab (.ptb) files cannot be drawn in the browser. Download it, open it in TuxGuitar and save it as .gp5, then upload that file.'
    }

    if (alphaTab.status === 'error') {
      return 'This file could not be read as a Guitar Pro tab. It may be damaged or from a version alphaTab does not support.'
    }

    if (alphaTab.status === 'loading') {
      return 'Drawing the tab…'
    }

    return undefined
  })()

  return (
    <section className={styles.viewer} aria-label="Tab viewer">
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.back}
          onClick={onClose}
          title={preview ? 'Back to the search (Esc)' : 'Back to player (Esc)'}
        >
          {preview ? '← Back' : '← Back to player'}
        </button>
        <div className={styles.heading}>
          <h2 className={styles.title}>{alphaTab.title ?? tab.name}</h2>
          {song && (
            <p className={styles.song}>
              {preview ? 'Preview for ' : ''}
              {song.name} — {song.artistNames.join(', ')}
            </p>
          )}
        </div>
        {preview && (
          <button
            type="button"
            className={styles.primary}
            onClick={(event) => {
              event.currentTarget.blur()
              preview.onAdd()
            }}
            disabled={preview.isAdding || dataStatus !== 'ready'}
          >
            {preview.isAdding ? 'Adding…' : 'Add to this song'}
          </button>
        )}
      </header>

      <main className={styles.stage}>
        {notice && (
          <div className={styles.notice}>
            <p className={styles.noticeText}>{notice}</p>
            {!isRenderable && data && (
              <button type="button" className={styles.ghost} onClick={() => downloadTab(tab, data)}>
                Download .ptb
              </button>
            )}
          </div>
        )}
        {isRenderable && (
          <div ref={setScrollElement} className={styles.paper} hidden={alphaTab.status === 'error'}>
            <div ref={setContainer} />
          </div>
        )}
      </main>

      <footer className={styles.bottomBar}>
        <div className={styles.barStart}>
          {isRenderable && alphaTab.status === 'ready' && (
            <div className={styles.group} role="group" aria-label="Tab playback">
              <button
                type="button"
                className={styles.primary}
                onClick={(event) => {
                  event.currentTarget.blur()
                  alphaTab.playPause()
                }}
                disabled={!alphaTab.isPlayerReady || isFollowing}
                title={
                  isFollowing
                    ? 'The tab is following Spotify'
                    : alphaTab.isPlayerReady
                      ? undefined
                      : 'Loading the sound font…'
                }
              >
                {alphaTab.isPlaying ? 'Pause tab' : 'Play tab'}
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={(event) => {
                  event.currentTarget.blur()
                  alphaTab.stop()
                }}
                disabled={!alphaTab.isPlayerReady || isFollowing}
              >
                Stop
              </button>
            </div>
          )}

          {spotifyPlayback && isRenderable && alphaTab.status === 'ready' && (
            <div className={styles.group} role="group" aria-label="Sync with Spotify">
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={sync.isEnabled}
                  onChange={(event) => {
                    // Two sources of sound at once is never what's wanted.
                    if (event.target.checked) {
                      alphaTab.stop()
                    }
                    sync.setEnabled(event.target.checked)
                    event.currentTarget.blur()
                  }}
                />
                <span>Sync with Spotify</span>
              </label>
              {sync.isEnabled && (
                <span className={styles.offset}>
                  <button
                    type="button"
                    className={styles.nudge}
                    onClick={(event) => {
                      event.currentTarget.blur()
                      sync.nudge(-SYNC_NUDGE_MS)
                    }}
                    aria-label="Move the tab half a second earlier"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.offsetValue}
                    onClick={(event) => {
                      event.currentTarget.blur()
                      sync.resetOffset()
                    }}
                    title="Offset from Spotify — click to reset"
                    aria-label={`Offset ${formatOffset(sync.offsetMs)}, click to reset`}
                  >
                    {formatOffset(sync.offsetMs)}
                  </button>
                  <button
                    type="button"
                    className={styles.nudge}
                    onClick={(event) => {
                      event.currentTarget.blur()
                      sync.nudge(SYNC_NUDGE_MS)
                    }}
                    aria-label="Move the tab half a second later"
                  >
                    +
                  </button>
                </span>
              )}
              {isFollowing && <span className={styles.syncHint}>Click the note you hear to line up</span>}
              {isOtherSong && (
                <span className={styles.warning} role="status">
                  Spotify is playing another song
                </span>
              )}
            </div>
          )}
        </div>

        {/* Spotify's transport keeps the middle, whatever sits either side. */}
        <div className={styles.barCenter}>
          {playbackControls && (
            <div className={styles.spotify} role="group" aria-label="Spotify playback">
              {playbackControls}
            </div>
          )}
        </div>

        <div className={styles.barEnd}>
          {alphaTab.tracks.length > 1 && (
            <label className={styles.field}>
              <span className={styles.label}>Track</span>
              <select
                className={styles.select}
                value={alphaTab.selectedTrackIndex}
                onChange={(event) => {
                  alphaTab.selectTrack(Number(event.target.value))
                  event.currentTarget.blur()
                }}
              >
                {alphaTab.tracks.map((track) => (
                  <option key={track.index} value={track.index}>
                    {track.name || `Track ${track.index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {songTabs.length > 1 && (
            <label className={styles.field}>
              <span className={styles.label}>Tab</span>
              <select
                className={styles.select}
                value={tab.id}
                onChange={(event) => {
                  onSelectTab(event.target.value)
                  event.currentTarget.blur()
                }}
              >
                {songTabs.map((songTab) => (
                  <option key={songTab.id} value={songTab.id}>
                    {songTab.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {onManage && (
            <button type="button" className={styles.quiet} onClick={onManage}>
              Manage tabs
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}
