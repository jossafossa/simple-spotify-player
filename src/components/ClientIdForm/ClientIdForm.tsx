import { useState } from 'react'
import styles from './ClientIdForm.module.scss'

type ClientIdFormProps = {
  redirectUri: string
  onSave: (clientId: string) => void
}

export const ClientIdForm = ({ redirectUri, onSave }: ClientIdFormProps) => {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const trimmedClientId = inputValue.trim()
    if (!trimmedClientId) {
      return
    }

    onSave(trimmedClientId)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h1 className={styles.title}>Connect Spotify</h1>
      <p className={styles.hint}>
        Paste the Client ID from your own app in the{' '}
        <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
          Spotify Developer Dashboard
        </a>
        . No client secret or backend needed — sign-in happens entirely in
        this browser.
      </p>
      <p className={styles.hint}>
        In that app's settings, add this exact Redirect URI (Spotify
        requires the loopback IP, not "localhost"):
        <code className={styles.redirectUri}>{redirectUri}</code>
      </p>
      <input
        className={styles.input}
        type="text"
        placeholder="Client ID"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        aria-label="Spotify Client ID"
        autoComplete="off"
      />
      <button className={styles.submit} type="submit" disabled={!inputValue.trim()}>
        Save
      </button>
    </form>
  )
}
