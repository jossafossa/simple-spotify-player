import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  hasRequiredScopes,
  redirectTo,
  refreshTokens,
} from '~/lib/spotifyAuth'
import { useSpotifyAuth } from './useSpotifyAuth'

vi.mock('~/lib/spotifyAuth', () => ({
  getRedirectUri: () => 'https://app.example.com/',
  buildAuthorizeUrl: vi.fn(() => 'https://accounts.spotify.com/authorize?mock=1'),
  redirectTo: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  refreshTokens: vi.fn(),
  hasRequiredScopes: vi.fn(() => true),
}))
vi.mock('~/lib/pkce', () => ({
  generateCodeVerifier: () => 'verifier-1',
  generateState: () => 'state-1',
  generateCodeChallenge: () => Promise.resolve('challenge-1'),
}))

const mockedBuildAuthorizeUrl = vi.mocked(buildAuthorizeUrl)
const mockedRedirectTo = vi.mocked(redirectTo)
const mockedExchangeCodeForTokens = vi.mocked(exchangeCodeForTokens)
const mockedRefreshTokens = vi.mocked(refreshTokens)
const mockedHasRequiredScopes = vi.mocked(hasRequiredScopes)

const setUrl = (pathAndQuery: string) => {
  window.history.pushState(null, '', pathAndQuery)
}

describe('useSpotifyAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setUrl('/')
  })

  afterEach(() => {
    mockedRedirectTo.mockReset()
    mockedExchangeCodeForTokens.mockReset()
    mockedRefreshTokens.mockReset()
  })

  it('starts at needs-client-id with nothing stored', () => {
    const { result } = renderHook(() => useSpotifyAuth())

    expect(result.current.status).toBe('needs-client-id')
    expect(result.current.accessToken).toBeUndefined()
  })

  it('moves to signed-out once a client id is set', () => {
    const { result } = renderHook(() => useSpotifyAuth())

    act(() => {
      result.current.setClientId('client-123')
    })

    expect(result.current.status).toBe('signed-out')
    expect(localStorage.getItem('spotify-player:client-id')).toBe('client-123')
  })

  it('login stores PKCE params and redirects to the authorize URL', async () => {
    const { result } = renderHook(() => useSpotifyAuth())
    act(() => {
      result.current.setClientId('client-123')
    })

    act(() => {
      result.current.login()
    })

    await waitFor(() => expect(mockedRedirectTo).toHaveBeenCalled())

    expect(sessionStorage.getItem('spotify-player:pkce-verifier')).toBe('verifier-1')
    expect(sessionStorage.getItem('spotify-player:pkce-state')).toBe('state-1')
    expect(mockedBuildAuthorizeUrl).toHaveBeenCalledWith({
      clientId: 'client-123',
      redirectUri: 'https://app.example.com/',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    })
    expect(mockedRedirectTo).toHaveBeenCalledWith('https://accounts.spotify.com/authorize?mock=1')
  })

  it('exchanges the code on redirect back and becomes authenticated', async () => {
    localStorage.setItem('spotify-player:client-id', 'client-123')
    sessionStorage.setItem('spotify-player:pkce-verifier', 'verifier-1')
    sessionStorage.setItem('spotify-player:pkce-state', 'state-1')
    setUrl('/?code=auth-code&state=state-1')
    mockedExchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 3_600_000,
    })

    const { result } = renderHook(() => useSpotifyAuth())

    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    expect(result.current.accessToken).toBe('access-1')
    expect(window.location.search).toBe('')
    expect(JSON.parse(localStorage.getItem('spotify-player:tokens')!)).toMatchObject({
      accessToken: 'access-1',
    })
    expect(sessionStorage.getItem('spotify-player:pkce-verifier')).toBeNull()
  })

  it('reports an error when Spotify redirects back with an oauth error', async () => {
    localStorage.setItem('spotify-player:client-id', 'client-123')
    setUrl('/?error=access_denied')

    const { result } = renderHook(() => useSpotifyAuth())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorMessage).toMatch(/cancelled/)
  })

  it('reports an error when the state does not match', async () => {
    localStorage.setItem('spotify-player:client-id', 'client-123')
    sessionStorage.setItem('spotify-player:pkce-verifier', 'verifier-1')
    sessionStorage.setItem('spotify-player:pkce-state', 'state-1')
    setUrl('/?code=auth-code&state=wrong-state')

    const { result } = renderHook(() => useSpotifyAuth())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockedExchangeCodeForTokens).not.toHaveBeenCalled()
  })

  it('discards stored tokens that predate a scope the app now needs', () => {
    mockedHasRequiredScopes.mockReturnValueOnce(false)
    localStorage.setItem('spotify-player:client-id', 'client-123')
    localStorage.setItem(
      'spotify-player:tokens',
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 }),
    )

    const { result } = renderHook(() => useSpotifyAuth())

    expect(result.current.status).toBe('signed-out')
    expect(result.current.accessToken).toBeUndefined()
    expect(localStorage.getItem('spotify-player:tokens')).toBeNull()
  })

  it('logout clears tokens but keeps the client id', () => {
    localStorage.setItem('spotify-player:client-id', 'client-123')
    localStorage.setItem(
      'spotify-player:tokens',
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 }),
    )

    const { result } = renderHook(() => useSpotifyAuth())

    act(() => {
      result.current.logout()
    })

    expect(result.current.status).toBe('signed-out')
    expect(result.current.clientId).toBe('client-123')
    expect(localStorage.getItem('spotify-player:tokens')).toBeNull()
  })

  it('changeClientId clears both tokens and the client id', () => {
    localStorage.setItem('spotify-player:client-id', 'client-123')
    localStorage.setItem(
      'spotify-player:tokens',
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 }),
    )

    const { result } = renderHook(() => useSpotifyAuth())

    act(() => {
      result.current.changeClientId()
    })

    expect(result.current.status).toBe('needs-client-id')
    expect(result.current.clientId).toBeUndefined()
    expect(localStorage.getItem('spotify-player:client-id')).toBeNull()
  })

  it('refreshes the access token shortly before it expires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    localStorage.setItem('spotify-player:client-id', 'client-123')
    localStorage.setItem(
      'spotify-player:tokens',
      JSON.stringify({ accessToken: 'old', refreshToken: 'refresh-1', expiresAt: Date.now() + 70_000 }),
    )
    mockedRefreshTokens.mockResolvedValue({
      accessToken: 'new',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 3_600_000,
      grantedScopes: ['streaming'],
    })

    const { result } = renderHook(() => useSpotifyAuth())

    await act(() => vi.advanceTimersByTimeAsync(70_000))

    expect(result.current.accessToken).toBe('new')
    vi.useRealTimers()
  })
})
