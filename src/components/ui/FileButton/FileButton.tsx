import { useRef } from 'react'
import styles from './FileButton.module.scss'

type FileButtonProps = {
  label: string
  accept: string
  onSelect: (file: File) => void
  disabled?: boolean
}

/** A button that opens the file picker, so the native input never shows. */
export const FileButton = ({ label, accept, onSelect, disabled }: FileButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <button
        type="button"
        className={styles.button}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept={accept}
        aria-label={label}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so picking the same file again still fires a change.
          event.target.value = ''

          if (file) {
            onSelect(file)
          }
        }}
      />
    </>
  )
}
