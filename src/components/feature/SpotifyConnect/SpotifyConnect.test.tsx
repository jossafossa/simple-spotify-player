import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SpotifyConnect } from './SpotifyConnect'

describe('SpotifyConnect', () => {
  it('shows a signing-in message with no actions', () => {
    render(
      <SpotifyConnect
        status="signing-in"
        errorMessage={undefined}
        onLogin={vi.fn()}
        onChangeClientId={vi.fn()}
      />,
    )

    expect(screen.getByText('Signing in to Spotify…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('lets the user connect when signed out', async () => {
    const handleLogin = vi.fn()
    const user = userEvent.setup()

    render(
      <SpotifyConnect
        status="signed-out"
        errorMessage={undefined}
        onLogin={handleLogin}
        onChangeClientId={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Connect Spotify' }))

    expect(handleLogin).toHaveBeenCalledOnce()
  })

  it('shows the error message with a retry action', async () => {
    const handleLogin = vi.fn()
    const user = userEvent.setup()

    render(
      <SpotifyConnect
        status="error"
        errorMessage="Sign-in failed. Please try again."
        onLogin={handleLogin}
        onChangeClientId={vi.fn()}
      />,
    )

    expect(screen.getByText('Sign-in failed. Please try again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(handleLogin).toHaveBeenCalledOnce()
  })

  it('lets the user change the client id from any non-signing-in state', async () => {
    const handleChangeClientId = vi.fn()
    const user = userEvent.setup()

    render(
      <SpotifyConnect
        status="signed-out"
        errorMessage={undefined}
        onLogin={vi.fn()}
        onChangeClientId={handleChangeClientId}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Use a different client ID' }))

    expect(handleChangeClientId).toHaveBeenCalledOnce()
  })
})
