import type { PlaybackMode } from '~/lib/playbackMode'
import styles from './ModeToggle.module.scss'

type ModeToggleProps = {
  mode: PlaybackMode
  onChange: (mode: PlaybackMode) => void
}

const OPTIONS: { mode: PlaybackMode; label: string; title: string }[] = [
  {
    mode: 'local',
    label: 'This browser',
    title: 'Play here, in the page. Needs a browser licensed for Widevine DRM.',
  },
  {
    mode: 'remote',
    label: 'Remote',
    title: 'Control Spotify running on another device.',
  },
]

export const ModeToggle = ({ mode, onChange }: ModeToggleProps) => (
  <div className={styles.toggle} role="group" aria-label="Playback mode">
    {OPTIONS.map((option) => (
      <button
        key={option.mode}
        type="button"
        className={styles.option}
        title={option.title}
        aria-pressed={mode === option.mode}
        onClick={() => onChange(option.mode)}
      >
        {option.label}
      </button>
    ))}
  </div>
)
