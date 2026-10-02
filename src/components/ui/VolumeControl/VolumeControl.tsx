import styles from './VolumeControl.module.scss'

type VolumeControlProps = {
  /** 0–100. */
  volumePercent: number
  isMuted: boolean
  onChange: (volumePercent: number) => void
  onToggleMute: () => void
}

const SpeakerIcon = ({ isMuted }: { isMuted: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 9v6h4l5 5V4L8 9z" />
    {isMuted ? (
      <path d="m16.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" fill="none" />
    ) : (
      <path
        d="M16 8.5a5 5 0 0 1 0 7m2.5-10a9 9 0 0 1 0 13"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    )}
  </svg>
)

export const VolumeControl = ({
  volumePercent,
  isMuted,
  onChange,
  onToggleMute,
}: VolumeControlProps) => (
  <div className={styles.wrapper}>
    <button
      type="button"
      className={styles.mute}
      onClick={onToggleMute}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
      aria-pressed={isMuted}
    >
      <SpeakerIcon isMuted={isMuted} />
    </button>
    <input
      type="range"
      className={styles.slider}
      min={0}
      max={100}
      step={1}
      value={volumePercent}
      aria-label="Volume"
      style={{ '--fill': `${volumePercent}%` } as React.CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
      // Leaving focus on the slider would keep Space and the arrow keys off
      // the global shortcuts once the drag is over.
      onPointerUp={(event) => event.currentTarget.blur()}
    />
    <span className={styles.value}>{volumePercent}</span>
  </div>
)
