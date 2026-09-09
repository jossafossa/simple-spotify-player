import { useCallback, useEffect, useState } from 'react'
import {
  clearStoredClientId,
  clearStoredTokens,
  consumePkceParams,
  readStoredClientId,
  readStoredTokens,
  savePkceParams,
  saveStoredClientId,
  saveStoredTokens,
} from '~/lib/authStorage'
import { deriveAuthStatus, type SpotifyAuthStatus } from '~/lib/deriveAuthStatus'
import { generateCodeChallenge, generateCodeVerifier, generateState } from '~/lib/pkce'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getRedirectUri,
  hasRequiredScopes,
  redirectTo,
  refreshTokens,
  type SpotifyTokens,
} from '~/lib/spotifyAuth'

export type { SpotifyAuthStatus }

export type UseSpotifyAuthResult = {
  status: SpotifyAuthStatus
  clientId: string | undefined
  accessToken: string | undefined
  errorMessage: string | undefined
  redirectUri: string
  setClientId: (clientId: string) => void
  login: () => void
  logout: () => void
  changeClientId: () => void
}

const REFRESH_MARGIN_MS = 60_000

/** Drops stored tokens that predate a scope this version of the app needs. */
const readUsableStoredTokens = (): SpotifyTokens | undefined => {
  const stored = readStoredTokens()

  if (stored && !hasRequiredScopes(stored)) {
    clearStoredTokens()
    return undefined
  }

  return stored
}

export const useSpotifyAuth = (): UseSpotifyAuthResult => {
  const [clientId, setClientIdState] = useState(readStoredClientId)
  const [tokens, setTokens] = useState(readUsableStoredTokens)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Handle the one-time redirect back from Spotify's authorize page.
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const oauthError = url.searchParams.get('error')

    if (!code && !oauthError) {
      return
    }

    window.history.replaceState(null, '', url.pathname)

    if (oauthError) {
      setErrorMessage('Spotify sign-in was cancelled.')
      return
    }

    const pkceParams = consumePkceParams()

    if (!code || !clientId || !pkceParams || state !== pkceParams.state) {
      setErrorMessage('Sign-in failed. Please try again.')
      return
    }

    setIsSigningIn(true)
    exchangeCodeForTokens({
      clientId,
      code,
      redirectUri: getRedirectUri(),
      codeVerifier: pkceParams.codeVerifier,
    })
      .then((newTokens) => {
        saveStoredTokens(newTokens)
        setTokens(newTokens)
      })
      .catch(() => setErrorMessage('Could not complete Spotify sign-in.'))
      .finally(() => setIsSigningIn(false))

    // Only ever meant to run once, right after the redirect back from Spotify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh the access token shortly before it expires.
  useEffect(() => {
    if (!tokens || !clientId) {
      return
    }

    const refreshTokensAndSchedule = (currentTokens: SpotifyTokens) => {
      refreshTokens({
        clientId,
        refreshToken: currentTokens.refreshToken,
        grantedScopes: currentTokens.grantedScopes,
      })
        .then((newTokens) => {
          saveStoredTokens(newTokens)
          setTokens(newTokens)
        })
        .catch(() => {
          clearStoredTokens()
          setTokens(undefined)
          setErrorMessage('Your Spotify session expired. Please sign in again.')
        })
    }

    const delayMs = Math.max(tokens.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)
    const timeoutId = setTimeout(() => refreshTokensAndSchedule(tokens), delayMs)

    return () => clearTimeout(timeoutId)
  }, [tokens, clientId])

  const setClientId = useCallback((newClientId: string) => {
    saveStoredClientId(newClientId)
    setClientIdState(newClientId)
    setErrorMessage(undefined)
  }, [])

  const login = useCallback(() => {
    if (!clientId) {
      return
    }

    setErrorMessage(undefined)

    const codeVerifier = generateCodeVerifier()
    const state = generateState()

    generateCodeChallenge(codeVerifier).then((codeChallenge) => {
      savePkceParams(codeVerifier, state)
      redirectTo(buildAuthorizeUrl({ clientId, redirectUri: getRedirectUri(), state, codeChallenge }))
    })
  }, [clientId])

  const logout = useCallback(() => {
    clearStoredTokens()
    setTokens(undefined)
    setErrorMessage(undefined)
  }, [])

  const changeClientId = useCallback(() => {
    clearStoredTokens()
    clearStoredClientId()
    setTokens(undefined)
    setClientIdState(undefined)
    setErrorMessage(undefined)
  }, [])

  return {
    status: deriveAuthStatus({ clientId, isSigningIn, hasTokens: !!tokens, errorMessage }),
    clientId,
    accessToken: tokens?.accessToken,
    errorMessage,
    redirectUri: getRedirectUri(),
    setClientId,
    login,
    logout,
    changeClientId,
  }
}
