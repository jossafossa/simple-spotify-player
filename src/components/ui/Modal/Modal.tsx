import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Modal.module.scss'

type ModalProps = {
  title: string
  /** Under the title, e.g. which song a dialog is about. */
  subtitle?: string
  /** Extra controls in the header, beside the close button. */
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}

export const Modal = ({ title, subtitle, actions, onClose, children }: ModalProps) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus moves in so Tab works at once, without a click first.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // On the window rather than the dialog: clicking a button that then
  // disappears, like Add, drops focus to the body, outside the dialog.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
