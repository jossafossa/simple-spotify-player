import type { KeyboardEvent, FocusEvent } from 'react'
import type { SpotifyTempoStatus } from '~/hooks/useSpotifyTempo'
import styles from './TempoControl.module.scss'

type TempoControlProps = {
  bpm: number
  /** The tempo the score is written in, to go back to. */
  scoreBpm: number
  /** True when the tempo was set rather than read from the score. */
  isSet: boolean
  onChange: (bpm: number) => void
  onTap: () => void
  /** Taps in the current run, shown while tapping. */
  tapCount: number
  onReset: () => void
  /** Left out where there is no Spotify song to ask about. */
  spotify?: { status: SpotifyTempoStatus; onRequest: () => void }
}

const formatBpm = (bpm: number): string => String(Math.round(bpm * 10) / 10)

const SPOTIFY_NOTICES: Partial<Record<SpotifyTempoStatus, string>> = {
  missing: 'Spotify has no tempo for this song',
  error: 'Could not reach Spotify',
}

/**
 * The tempo a tab plays and syncs at, typed in, tapped along to the music or
 * read from Spotify. Set to the recording's tempo, a synced cursor no longer
 * drifts away from what is heard.
 */
export const TempoControl = ({
  bpm,
  scoreBpm,
  isSet,
  onChange,
  onTap,
  tapCount,
  onReset,
  spotify,
}: TempoControlProps) => {
  const commit = (input: HTMLInputElement) => {
    const next = Number(input.value)
    if (input.value.trim() === '' || !Number.isFinite(next) || next <= 0) {
      input.value = formatBpm(bpm)
      return
    }

    onChange(next)
  }

  const notice = spotify && SPOTIFY_NOTICES[spotify.status]

  return (
    <div className={styles.tempo} role="group" aria-label="Tempo">
      <label className={styles.field}>
        <span className={styles.label}>BPM</span>
        <input
          // A new tempo from a tap or from Spotify replaces whatever is typed.
          key={bpm}
          className={styles.input}
          type="number"
          inputMode="decimal"
          min={20}
          max={400}
          step={0.1}
          defaultValue={formatBpm(bpm)}
          onBlur={(event: FocusEvent<HTMLInputElement>) => commit(event.currentTarget)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
      </label>
      <button
        type="button"
        className={styles.button}
        // On press, not release: the press is what lands on the beat. Keeping
        // focus off the button leaves Space to play and pause.
        onPointerDown={(event) => {
          event.preventDefault()
          onTap()
        }}
        title="Tap along to the beat (T) — the more taps, the closer the tempo"
        aria-label="Tap"
      >
        {tapCount > 0 ? `Tap ${tapCount}` : 'Tap'}
      </button>
      {spotify && spotify.status !== 'unavailable' && (
        <button
          type="button"
          className={styles.button}
          onClick={(event) => {
            event.currentTarget.blur()
            spotify.onRequest()
          }}
          disabled={spotify.status === 'loading'}
          title="Use the tempo Spotify measured for this song"
        >
          {spotify.status === 'loading' ? 'Asking…' : 'Spotify'}
        </button>
      )}
      {isSet && (
        <button
          type="button"
          className={styles.reset}
          onClick={(event) => {
            event.currentTarget.blur()
            onReset()
          }}
          title="Go back to the tempo the tab is written in"
        >
          Tab: {formatBpm(scoreBpm)}
        </button>
      )}
      {notice && <span className={styles.notice}>{notice}</span>}
    </div>
  )
}
