import styles from './Controls.module.scss'

type ControlsProps = {
  isPaused: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  /** The shuffle button only appears when there is something to toggle. */
  isShuffled?: boolean
  onToggleShuffle?: () => void
}

export const Controls = ({
  isPaused,
  onTogglePlay,
  onNext,
  onPrevious,
  isShuffled = false,
  onToggleShuffle,
}: ControlsProps) => (
  <div className={styles.controls}>
    {onToggleShuffle && (
      <button
        type="button"
        className={`${styles.button} ${styles.toggle}`}
        onClick={onToggleShuffle}
        aria-label="Shuffle"
        aria-pressed={isShuffled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14.8 4H20v5.2l-1.9-1.9-3.4 3.4-1.4-1.4 3.4-3.4zM4 5.4 5.4 4 20 18.6 18.6 20zM20 14.8V20h-5.2l1.9-1.9-2.9-2.9 1.4-1.4 2.9 2.9z" />
        </svg>
      </button>
    )}
    <button
      type="button"
      className={styles.button}
      onClick={onPrevious}
      aria-label="Previous track"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6zm3.5 6 10.5 6.5v-13z" />
      </svg>
    </button>
    <button
      type="button"
      className={`${styles.button} ${styles.playButton}`}
      onClick={onTogglePlay}
      aria-label={isPaused ? 'Play' : 'Pause'}
    >
      {isPaused ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 5v14l12-7z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
        </svg>
      )}
    </button>
    <button type="button" className={styles.button} onClick={onNext} aria-label="Next track">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 6h2v12h-2zM4 6l10.5 6.5L4 19z" />
      </svg>
    </button>
  </div>
)
