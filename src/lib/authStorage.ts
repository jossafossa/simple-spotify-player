import type { SpotifyTokens } from './spotifyAuth'

const CLIENT_ID_KEY = 'spotify-player:client-id'
const TOKENS_KEY = 'spotify-player:tokens'
const PKCE_VERIFIER_KEY = 'spotify-player:pkce-verifier'
const PKCE_STATE_KEY = 'spotify-player:pkce-state'

export const readStoredClientId = (): string | undefined => {
  try {
    return localStorage.getItem(CLIENT_ID_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export const saveStoredClientId = (clientId: string): void => {
  localStorage.setItem(CLIENT_ID_KEY, clientId)
}

export const clearStoredClientId = (): void => {
  localStorage.removeItem(CLIENT_ID_KEY)
}

export const readStoredTokens = (): SpotifyTokens | undefined => {
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? (JSON.parse(raw) as SpotifyTokens) : undefined
  } catch {
    return undefined
  }
}

export const saveStoredTokens = (tokens: SpotifyTokens): void => {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

export const clearStoredTokens = (): void => {
  localStorage.removeItem(TOKENS_KEY)
}

/**
 * PKCE params only need to survive the redirect to Spotify's authorize page
 * and back, so sessionStorage (not localStorage) is the right lifetime.
 */
export const savePkceParams = (codeVerifier: string, state: string): void => {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier)
  sessionStorage.setItem(PKCE_STATE_KEY, state)
}

type PkceParams = {
  codeVerifier: string
  state: string
}

/** Reads and clears the stored PKCE params — they're only ever used once. */
export const consumePkceParams = (): PkceParams | undefined => {
  const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  const state = sessionStorage.getItem(PKCE_STATE_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_STATE_KEY)

  return codeVerifier && state ? { codeVerifier, state } : undefined
}
