import styles from './Controls.module.scss'

type ControlsProps = {
  isPaused: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
}

export const Controls = ({ isPaused, onTogglePlay, onNext, onPrevious }: ControlsProps) => (
  <div className={styles.controls}>
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
