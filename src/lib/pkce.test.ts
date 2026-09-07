import { describe, expect, it } from 'vitest'
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce'

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

describe('generateCodeVerifier', () => {
  it('produces a base64url string with no padding', () => {
    const verifier = generateCodeVerifier()

    expect(verifier).toMatch(BASE64URL_PATTERN)
  })

  it('produces a different value each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })
})

describe('generateState', () => {
  it('produces a base64url string with no padding', () => {
    expect(generateState()).toMatch(BASE64URL_PATTERN)
  })
})

describe('generateCodeChallenge', () => {
  it('derives the S256 challenge for a known verifier', async () => {
    // Known-answer test vector from RFC 7636 appendix B.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

    const challenge = await generateCodeChallenge(verifier)

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('is deterministic for the same verifier', async () => {
    const verifier = generateCodeVerifier()

    const first = await generateCodeChallenge(verifier)
    const second = await generateCodeChallenge(verifier)

    expect(first).toBe(second)
  })
})
