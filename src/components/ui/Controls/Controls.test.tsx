import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Controls } from './Controls'

describe('Controls', () => {
  it('shows a play button and calls onTogglePlay when paused', async () => {
    const handleTogglePlay = vi.fn()
    const user = userEvent.setup()

    render(
      <Controls
        isPaused
        onTogglePlay={handleTogglePlay}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(handleTogglePlay).toHaveBeenCalledOnce()
  })

  it('shows a pause button when playing', () => {
    render(
      <Controls
        isPaused={false}
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('calls onNext and onPrevious', async () => {
    const handleNext = vi.fn()
    const handlePrevious = vi.fn()
    const user = userEvent.setup()

    render(
      <Controls
        isPaused
        onTogglePlay={vi.fn()}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Next track' }))
    await user.click(screen.getByRole('button', { name: 'Previous track' }))

    expect(handleNext).toHaveBeenCalledOnce()
    expect(handlePrevious).toHaveBeenCalledOnce()
  })

  it('leaves shuffle out when there is nothing to toggle', () => {
    render(<Controls isPaused onTogglePlay={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Shuffle' })).not.toBeInTheDocument()
  })

  it('toggles shuffle and shows whether it is on', async () => {
    const handleToggleShuffle = vi.fn()
    const user = userEvent.setup()

    render(
      <Controls
        isPaused
        onTogglePlay={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        isShuffled
        onToggleShuffle={handleToggleShuffle}
      />,
    )

    const shuffle = screen.getByRole('button', { name: 'Shuffle' })
    expect(shuffle).toHaveAttribute('aria-pressed', 'true')

    await user.click(shuffle)
    expect(handleToggleShuffle).toHaveBeenCalledOnce()
  })
})
