import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSpotifyAuth } from '~/hooks/useSpotifyAuth'
import { App } from './App'

vi.mock('~/hooks/useSpotifyAuth', () => ({
  useSpotifyAuth: vi.fn(),
}))
vi.mock('~/components', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ClientIdForm: () => <div>client-id-form</div>,
  SpotifyConnect: ({ status }: { status: string }) => <div>spotify-connect:{status}</div>,
  Player: ({ accessToken }: { accessToken: string }) => <div>player:{accessToken}</div>,
}))

const mockedUseSpotifyAuth = vi.mocked(useSpotifyAuth)

const baseAuth = {
  clientId: undefined,
  accessToken: undefined,
  errorMessage: undefined,
  redirectUri: 'https://app.example.com/',
  setClientId: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changeClientId: vi.fn(),
}

describe('App', () => {
  it('shows the client id form when a client id is needed', () => {
    mockedUseSpotifyAuth.mockReturnValue({ ...baseAuth, status: 'needs-client-id' })

    render(<App />)

    expect(screen.getByText('client-id-form')).toBeInTheDocument()
  })

  it('shows the connect screen when signed out', () => {
    mockedUseSpotifyAuth.mockReturnValue({ ...baseAuth, status: 'signed-out', clientId: 'c1' })

    render(<App />)

    expect(screen.getByText('spotify-connect:signed-out')).toBeInTheDocument()
  })

  it('shows the connect screen while signing in', () => {
    mockedUseSpotifyAuth.mockReturnValue({ ...baseAuth, status: 'signing-in', clientId: 'c1' })

    render(<App />)

    expect(screen.getByText('spotify-connect:signing-in')).toBeInTheDocument()
  })

  it('shows the connect screen on error', () => {
    mockedUseSpotifyAuth.mockReturnValue({
      ...baseAuth,
      status: 'error',
      clientId: 'c1',
      errorMessage: 'nope',
    })

    render(<App />)

    expect(screen.getByText('spotify-connect:error')).toBeInTheDocument()
  })

  it('shows the player once authenticated', () => {
    mockedUseSpotifyAuth.mockReturnValue({
      ...baseAuth,
      status: 'authenticated',
      clientId: 'c1',
      accessToken: 'access-1',
    })

    render(<App />)

    expect(screen.getByText('player:access-1')).toBeInTheDocument()
  })
})
