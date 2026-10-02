import type { ReactNode } from 'react'
import styles from './Card.module.scss'

type CardProps = {
  /** Names the card as a region of the page, for assistive technology. */
  label?: string
  children: ReactNode
}

export const Card = ({ label, children }: CardProps) =>
  label ? (
    <section className={styles.card} aria-label={label}>
      {children}
    </section>
  ) : (
    <div className={styles.card}>{children}</div>
  )
