import { useRef } from 'react'
import { formatTime } from '~/lib/formatTime'
import styles from './ProgressBar.module.scss'

type ProgressBarProps = {
  positionMs: number
  durationMs: number
  onSeek: (positionMs: number) => void
}

export const ProgressBar = ({ positionMs, durationMs, onSeek }: ProgressBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const progressRatio = durationMs > 0 ? Math.min(positionMs / durationMs, 1) : 0

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track) {
      return
    }

    const { left, width } = track.getBoundingClientRect()
    const clickRatio = Math.min(Math.max((event.clientX - left) / width, 0), 1)
    onSeek(Math.round(clickRatio * durationMs))
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.time}>{formatTime(positionMs)}</span>
      <div
        ref={trackRef}
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={positionMs}
        onClick={handleTrackClick}
      >
        <div className={styles.fill} style={{ width: `${progressRatio * 100}%` }} />
      </div>
      <span className={styles.time}>{formatTime(durationMs)}</span>
    </div>
  )
}
