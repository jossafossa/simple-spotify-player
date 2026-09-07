const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
]

/**
 * Must be registered exactly (including trailing slash) as a Redirect URI
 * on the Spotify app so the PKCE code exchange is accepted.
 */
export const getRedirectUri = (): string => new URL('/', window.location.origin).toString()

/** Isolated so tests can stub navigation without fighting jsdom's location. */
export const redirectTo = (url: string): void => {
  window.location.assign(url)
}

type BuildAuthorizeUrlParams = {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

export const buildAuthorizeUrl = ({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: BuildAuthorizeUrlParams): string => {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('scope', SPOTIFY_SCOPES.join(' '))
  return url.toString()
}

export type SpotifyTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

const toSpotifyTokens = (data: TokenResponse, fallbackRefreshToken: string): SpotifyTokens => ({
  accessToken: data.access_token,
  refreshToken: data.refresh_token ?? fallbackRefreshToken,
  expiresAt: Date.now() + data.expires_in * 1000,
})

const requestToken = async (body: URLSearchParams): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify token request failed with status ${response.status}`)
  }

  return (await response.json()) as TokenResponse
}

type ExchangeCodeForTokensParams = {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
}

export const exchangeCodeForTokens = async ({
  clientId,
  code,
  redirectUri,
  codeVerifier,
}: ExchangeCodeForTokensParams): Promise<SpotifyTokens> => {
  const data = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  )

  return toSpotifyTokens(data, '')
}

type RefreshTokensParams = {
  clientId: string
  refreshToken: string
}

export const refreshTokens = async ({
  clientId,
  refreshToken,
}: RefreshTokensParams): Promise<SpotifyTokens> => {
  const data = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  )

  return toSpotifyTokens(data, refreshToken)
}
