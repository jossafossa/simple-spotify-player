import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClientIdForm } from './ClientIdForm'

describe('ClientIdForm', () => {
  it('shows the redirect URI to register with Spotify', () => {
    render(<ClientIdForm redirectUri="https://app.example.com/" onSave={vi.fn()} />)

    expect(screen.getByText('https://app.example.com/')).toBeInTheDocument()
  })

  it('disables submit until a client id is entered', () => {
    render(<ClientIdForm redirectUri="https://app.example.com/" onSave={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('calls onSave with the trimmed client id', async () => {
    const handleSave = vi.fn()
    const user = userEvent.setup()

    render(<ClientIdForm redirectUri="https://app.example.com/" onSave={handleSave} />)

    await user.type(screen.getByLabelText('Spotify Client ID'), '  client-123  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(handleSave).toHaveBeenCalledWith('client-123')
  })
})
