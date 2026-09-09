import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModeToggle } from './ModeToggle'

describe('ModeToggle', () => {
  it('marks the active mode as pressed', () => {
    render(<ModeToggle mode="remote" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'This browser' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the mode the user picked', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<ModeToggle mode="remote" onChange={handleChange} />)

    await user.click(screen.getByRole('button', { name: 'This browser' }))
    expect(handleChange).toHaveBeenCalledWith('local')
  })
})
