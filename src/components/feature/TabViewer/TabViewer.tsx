import { useState, type ReactNode } from 'react'
import { useAlphaTab } from '~/hooks/useAlphaTab'
import { useFullPageView } from '~/hooks/useFullPageView'
import type { TabDataStatus } from '~/hooks/useTabData'
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
  onSelectTab: (tabId: string) => void
  onManage: (() => void) | undefined
  onClose: () => void
}

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
  onSelectTab,
  onManage,
  onClose,
}: TabViewerProps) => {
  const isRenderable = isRenderableFormat(tab.format)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const alphaTab = useAlphaTab({ container, scrollElement }, isRenderable ? data : undefined)
  useFullPageView(onClose)

  const notice = (() => {
    if (dataStatus === 'loading') {
      return 'Opening the file…'
    }

    if (dataStatus === 'missing' || dataStatus === 'error') {
      return 'This tab file could not be read from the library.'
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
          title="Back to player (Esc)"
        >
          ← Back to player
        </button>
        <div className={styles.heading}>
          <h2 className={styles.title}>{alphaTab.title ?? tab.name}</h2>
          {song && (
            <p className={styles.song}>
              {song.name} — {song.artistNames.join(', ')}
            </p>
          )}
        </div>
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
        {isRenderable && alphaTab.status === 'ready' && (
          <div className={styles.group} role="group" aria-label="Tab playback">
            <button
              type="button"
              className={styles.primary}
              onClick={(event) => {
                event.currentTarget.blur()
                alphaTab.playPause()
              }}
              disabled={!alphaTab.isPlayerReady}
              title={alphaTab.isPlayerReady ? undefined : 'Loading the sound font…'}
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
              disabled={!alphaTab.isPlayerReady}
            >
              Stop
            </button>
          </div>
        )}

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

        {playbackControls && (
          <div className={styles.spotify} role="group" aria-label="Spotify playback">
            {playbackControls}
          </div>
        )}
      </footer>
    </section>
  )
}
