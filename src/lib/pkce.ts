const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const generateCodeVerifier = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(64))
  return base64UrlEncode(randomBytes)
}

export const generateState = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  return base64UrlEncode(randomBytes)
}

export const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64UrlEncode(new Uint8Array(digest))
}
