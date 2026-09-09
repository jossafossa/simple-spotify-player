import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getRedirectUri,
  hasRequiredScopes,
  refreshTokens,
  SPOTIFY_SCOPES,
} from './spotifyAuth'

describe('getRedirectUri', () => {
  it('normalizes to the origin root path', () => {
    expect(getRedirectUri()).toBe(`${window.location.origin}/`)
  })
})

describe('buildAuthorizeUrl', () => {
  it('includes all required PKCE authorize parameters', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-123',
        redirectUri: 'https://app.example.com/',
        state: 'state-abc',
        codeChallenge: 'challenge-xyz',
      }),
    )

    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-123')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/')
    expect(url.searchParams.get('state')).toBe('state-abc')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-xyz')
    expect(url.searchParams.get('scope')).toBe(SPOTIFY_SCOPES.join(' '))
  })
})

describe('exchangeCodeForTokens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the authorization_code grant and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const before = Date.now()

    const tokens = await exchangeCodeForTokens({
      clientId: 'client-123',
      code: 'auth-code',
      redirectUri: 'https://app.example.com/',
      codeVerifier: 'verifier-1',
    })

    expect(tokens.accessToken).toBe('access-1')
    expect(tokens.refreshToken).toBe('refresh-1')
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://accounts.spotify.com/api/token')
    const body = init.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_id')).toBe('client-123')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBe('verifier-1')
  })

  it('throws when the token endpoint rejects the request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

    await expect(
      exchangeCodeForTokens({
        clientId: 'client-123',
        code: 'bad-code',
        redirectUri: 'https://app.example.com/',
        codeVerifier: 'verifier-1',
      }),
    ).rejects.toThrow()
  })
})

describe('refreshTokens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the refresh_token grant and falls back to the old refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'access-2', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await refreshTokens({
      clientId: 'client-123',
      refreshToken: 'refresh-1',
      grantedScopes: ['streaming'],
    })

    expect(tokens.accessToken).toBe('access-2')
    expect(tokens.refreshToken).toBe('refresh-1')

    const [, init] = fetchMock.mock.calls[0]!
    const body = init.body as URLSearchParams
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('refresh-1')
  })
})

describe('hasRequiredScopes', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 0 }

  it('accepts a token granted every scope the app asks for', () => {
    expect(hasRequiredScopes({ ...tokens, grantedScopes: [...SPOTIFY_SCOPES] })).toBe(true)
  })

  it('rejects a token granted only some of them', () => {
    expect(hasRequiredScopes({ ...tokens, grantedScopes: ['streaming'] })).toBe(false)
  })

  it('rejects a token stored before scopes were recorded at all', () => {
    expect(hasRequiredScopes(tokens)).toBe(false)
  })
})
