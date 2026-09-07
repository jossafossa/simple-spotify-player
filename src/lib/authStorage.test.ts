import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredClientId,
  clearStoredTokens,
  consumePkceParams,
  readStoredClientId,
  readStoredTokens,
  savePkceParams,
  saveStoredClientId,
  saveStoredTokens,
} from './authStorage'

describe('client id storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is undefined when nothing is stored', () => {
    expect(readStoredClientId()).toBeUndefined()
  })

  it('round-trips a saved client id', () => {
    saveStoredClientId('client-123')
    expect(readStoredClientId()).toBe('client-123')
  })

  it('clears the stored client id', () => {
    saveStoredClientId('client-123')
    clearStoredClientId()
    expect(readStoredClientId()).toBeUndefined()
  })
})

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 123 }

  it('is undefined when nothing is stored', () => {
    expect(readStoredTokens()).toBeUndefined()
  })

  it('round-trips saved tokens', () => {
    saveStoredTokens(tokens)
    expect(readStoredTokens()).toEqual(tokens)
  })

  it('clears the stored tokens', () => {
    saveStoredTokens(tokens)
    clearStoredTokens()
    expect(readStoredTokens()).toBeUndefined()
  })

  it('treats malformed stored JSON as absent', () => {
    localStorage.setItem('spotify-player:tokens', 'not json')
    expect(readStoredTokens()).toBeUndefined()
  })
})

describe('PKCE param storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('is undefined when nothing is stored', () => {
    expect(consumePkceParams()).toBeUndefined()
  })

  it('returns saved params once and then clears them', () => {
    savePkceParams('verifier-1', 'state-1')

    expect(consumePkceParams()).toEqual({ codeVerifier: 'verifier-1', state: 'state-1' })
    expect(consumePkceParams()).toBeUndefined()
  })
})
