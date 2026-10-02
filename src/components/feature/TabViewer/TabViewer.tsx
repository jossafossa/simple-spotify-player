import { useEffect, useId, useRef, useState } from 'react'
import { TempoControl } from '~/components/feature/TempoControl'
import { Controls } from '~/components/ui/Controls'
import { useAlphaTab } from '~/hooks/useAlphaTab'
import { useFullPageView } from '~/hooks/useFullPageView'
import { useSpaceKey } from '~/hooks/useSpaceKey'
import { useSpotifyTempo } from '~/hooks/useSpotifyTempo'
import { useTabTempo } from '~/hooks/useTabTempo'
import { useTapTempo } from '~/hooks/useTapTempo'
import { clampBpm } from '~/lib/tempo'
import { useTabSync } from '~/hooks/useTabSync'
import type { TabDataStatus } from '~/hooks/useTabData'
import { readTabOptionsOpen, saveTabOptionsOpen } from '~/lib/tabOptionsStorage'
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
  /** Spotify's playback, to play along with or for the cursor to follow. */
  spotifyPlayback?: SpotifyPlayback
  /** Set while the tab is only being previewed, not yet on the song. */
  preview?: { onAdd: () => void; isAdding: boolean }
  /** Asks Spotify for the tempo it measured for a song. */
  loadSongBpm?: (song: SongRef) => Promise<number | undefined>
  onSelectTab: (tabId: string) => void
  onManage: (() => void) | undefined
  onClose: () => void
}

export type SpotifyPlayback = {
  track: SongRef
  positionMs: number
  isPaused: boolean
  togglePlay: () => void
  next: () => void
  previous: () => void
}

/** What the transport plays: Spotify, with the cursor following, or the tab itself. */
type SoundSource = 'spotify' | 'tab'

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
  spotifyPlayback,
  preview,
  loadSongBpm,
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
  const tempo = useTabTempo(tab.id)
  const alphaTab = useAlphaTab({ container, scrollElement }, isRenderable ? data : undefined, {
    onBeatClick: (tabTimeMs) => alignToRef.current(tabTimeMs),
    initialTrackIndex: readTabSettings(tab.id).trackIndex,
    onTrackSelect: (trackIndex) => saveTabSettings(tab.id, { trackIndex }),
    bpm: tempo.bpm,
  })
  // The score's own tempo is the default, so it is not remembered as set.
  const setBpm = (bpm: number) =>
    clampBpm(bpm) === alphaTab.scoreBpm ? tempo.reset() : tempo.setBpm(bpm)
  const tapTempo = useTapTempo(setBpm)
  const spotifyTempo = useSpotifyTempo(
    song && loadSongBpm ? () => loadSongBpm(song) : undefined,
    setBpm,
  )
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
  const canPlayTab = isRenderable && alphaTab.status === 'ready'
  const canFollowSpotify = canPlayTab && !!spotifyPlayback
  const isFollowing = canFollowSpotify && sync.isEnabled
  // A tab that cannot play leaves the transport to Spotify.
  const soundSource: SoundSource | undefined = isFollowing
    ? 'spotify'
    : canPlayTab
      ? 'tab'
      : spotifyPlayback
        ? 'spotify'
        : undefined

  // Two sources of sound at once is never what's wanted.
  const chooseSoundSource = (next: SoundSource) => {
    if (next === 'spotify') {
      alphaTab.stop()
    } else if (spotifyPlayback && !spotifyPlayback.isPaused) {
      spotifyPlayback.togglePlay()
    }
    sync.setEnabled(next === 'spotify')
  }

  useSpaceKey(soundSource === 'tab' ? alphaTab.playPause : undefined)

  // Settings seldom changed while playing sit in a strip of their own, so
  // the bar keeps to what is used all the time. Whether the strip is open
  // is remembered, since every new song opens a fresh viewer.
  const optionsId = useId()
  const [isOptionsOpen, setIsOptionsOpen] = useState(readTabOptionsOpen)
  const toggleOptions = () => {
    setIsOptionsOpen(!isOptionsOpen)
    saveTabOptionsOpen(!isOptionsOpen)
  }
  const hasOptions =
    (canPlayTab && alphaTab.scoreBpm !== undefined) ||
    alphaTab.tracks.length > 1 ||
    songTabs.length > 1 ||
    !!onManage

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

      {hasOptions && isOptionsOpen && (
        <div id={optionsId} className={styles.options} role="region" aria-label="Tab options">
          {isRenderable && alphaTab.status === 'ready' && alphaTab.scoreBpm && (
            <TempoControl
              bpm={tempo.bpm ?? alphaTab.scoreBpm}
              scoreBpm={alphaTab.scoreBpm}
              isSet={tempo.bpm !== undefined}
              onChange={setBpm}
              onTap={tapTempo.tap}
              tapCount={tapTempo.tapCount}
              onReset={tempo.reset}
              spotify={
                song && loadSongBpm
                  ? { status: spotifyTempo.status, onRequest: spotifyTempo.request }
                  : undefined
              }
            />
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
        </div>
      )}

      <footer className={styles.bottomBar}>
        <div className={styles.barStart}>
          {canFollowSpotify && (
            <div className={styles.group} role="group" aria-label="Sound">
              <label className={styles.field}>
                <span className={styles.label}>Sound</span>
                <select
                  className={styles.select}
                  value={soundSource}
                  onChange={(event) => {
                    chooseSoundSource(event.target.value as SoundSource)
                    event.currentTarget.blur()
                  }}
                >
                  <option value="spotify">Spotify</option>
                  <option value="tab">Tab</option>
                </select>
              </label>
              {isFollowing && (
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
            </div>
          )}
        </div>

        {/* The transport keeps the middle, whatever sits either side. */}
        <div className={styles.barCenter}>
          {soundSource === 'tab' && (
            <div
              className={styles.transport}
              role="group"
              aria-label="Tab playback"
              title={alphaTab.isPlayerReady ? undefined : 'Loading the sound font…'}
            >
              <Controls
                isPaused={!alphaTab.isPlaying}
                onTogglePlay={alphaTab.playPause}
                isPlayDisabled={!alphaTab.isPlayerReady}
                onPrevious={alphaTab.stop}
                previousLabel="Back to the start"
              />
            </div>
          )}
          {soundSource === 'spotify' && spotifyPlayback && (
            <div className={styles.transport} role="group" aria-label="Spotify playback">
              <Controls
                isPaused={spotifyPlayback.isPaused}
                onTogglePlay={spotifyPlayback.togglePlay}
                onNext={spotifyPlayback.next}
                onPrevious={spotifyPlayback.previous}
              />
            </div>
          )}
        </div>

        <div className={styles.barEnd}>
          {hasOptions && (
            <button
              type="button"
              className={styles.ghost}
              aria-expanded={isOptionsOpen}
              aria-controls={optionsId}
              onClick={(event) => {
                event.currentTarget.blur()
                toggleOptions()
              }}
            >
              Options
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}
