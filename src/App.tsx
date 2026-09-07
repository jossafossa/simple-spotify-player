import { Card, ClientIdForm, Player, SpotifyConnect } from '~/components'
import { useSpotifyAuth } from '~/hooks/useSpotifyAuth'
import styles from './App.module.scss'

export const App = () => {
  const {
    status,
    accessToken,
    errorMessage,
    redirectUri,
    setClientId,
    login,
    logout,
    changeClientId,
  } = useSpotifyAuth()

  return (
    <div className={styles.app}>
      {status === 'needs-client-id' && (
        <Card>
          <ClientIdForm redirectUri={redirectUri} onSave={setClientId} />
        </Card>
      )}
      {status !== 'needs-client-id' && status !== 'authenticated' && (
        <Card>
          <SpotifyConnect
            status={status}
            errorMessage={errorMessage}
            onLogin={login}
            onChangeClientId={changeClientId}
          />
        </Card>
      )}
      {status === 'authenticated' && accessToken && (
        <Player accessToken={accessToken} onLogout={logout} />
      )}
    </div>
  )
}
