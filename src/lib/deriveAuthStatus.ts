export type SpotifyAuthStatus = 'needs-client-id' | 'signing-in' | 'signed-out' | 'authenticated' | 'error'

type DeriveAuthStatusParams = {
  clientId: string | undefined
  isSigningIn: boolean
  hasTokens: boolean
  errorMessage: string | undefined
}

export const deriveAuthStatus = ({
  clientId,
  isSigningIn,
  hasTokens,
  errorMessage,
}: DeriveAuthStatusParams): SpotifyAuthStatus => {
  if (errorMessage) {
    return 'error'
  }

  if (!clientId) {
    return 'needs-client-id'
  }

  if (isSigningIn) {
    return 'signing-in'
  }

  if (hasTokens) {
    return 'authenticated'
  }

  return 'signed-out'
}
