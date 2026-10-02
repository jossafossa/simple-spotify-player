import type { ReactNode } from 'react'
import styles from './AppBar.module.scss'

type AppBarProps = {
  /** Settings for what plays, at the left. */
  start: ReactNode
  /** Places to go and the way out, at the right. */
  end: ReactNode
}

/** A slim bar across the top for everything that is not the content itself. */
export const AppBar = ({ start, end }: AppBarProps) => (
  <header className={styles.bar}>
    <div className={styles.group}>{start}</div>
    <div className={styles.group}>{end}</div>
  </header>
)
