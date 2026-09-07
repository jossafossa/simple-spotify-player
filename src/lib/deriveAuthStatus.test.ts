import { describe, expect, it } from 'vitest'
import { deriveAuthStatus } from './deriveAuthStatus'

const base = { clientId: 'client-1', isSigningIn: false, hasTokens: false, errorMessage: undefined }

describe('deriveAuthStatus', () => {
  it('is needs-client-id when there is no client id', () => {
    expect(deriveAuthStatus({ ...base, clientId: undefined })).toBe('needs-client-id')
  })

  it('is error when there is an error message, even with a client id and tokens', () => {
    expect(
      deriveAuthStatus({ ...base, hasTokens: true, errorMessage: 'oh no' }),
    ).toBe('error')
  })

  it('is signing-in while exchanging the code', () => {
    expect(deriveAuthStatus({ ...base, isSigningIn: true })).toBe('signing-in')
  })

  it('is authenticated once tokens are present', () => {
    expect(deriveAuthStatus({ ...base, hasTokens: true })).toBe('authenticated')
  })

  it('is signed-out with a client id but no tokens', () => {
    expect(deriveAuthStatus(base)).toBe('signed-out')
  })
})
