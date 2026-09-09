import type { SpotifyAuthStatus } from '~/lib/deriveAuthStatus'
import styles from './SpotifyConnect.module.scss'

type SpotifyConnectProps = {
  status: Extract<SpotifyAuthStatus, 'signing-in' | 'signed-out' | 'error'>
  errorMessage: string | undefined
  onLogin: () => void
  onChangeClientId: () => void
}

export const SpotifyConnect = ({
  status,
  errorMessage,
  onLogin,
  onChangeClientId,
}: SpotifyConnectProps) => {
  const changeClientIdLink = (
    <button type="button" className={styles.changeClientId} onClick={onChangeClientId}>
      Use a different client ID
    </button>
  )

  if (status === 'signing-in') {
    return <p className={styles.message}>Signing in to Spotify…</p>
  }

  if (status === 'error') {
    return (
      <>
        <p className={styles.error}>{errorMessage}</p>
        <button type="button" className={styles.connect} onClick={onLogin}>
          Try again
        </button>
        {changeClientIdLink}
      </>
    )
  }

  return (
    <>
      <p className={styles.message}>Connect your Spotify account to start controlling playback.</p>
      <button type="button" className={styles.connect} onClick={onLogin}>
        Connect Spotify
      </button>
      {changeClientIdLink}
    </>
  )
}
