import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VolumeControl } from './VolumeControl'

describe('VolumeControl', () => {
  it('shows the current level', () => {
    const { getByRole, getByText } = render(
      <VolumeControl volumePercent={40} isMuted={false} onChange={vi.fn()} onToggleMute={vi.fn()} />,
    )

    expect(getByRole('slider', { name: 'Volume' })).toHaveValue('40')
    expect(getByText('40')).toBeInTheDocument()
  })

  it('reports a new level from the slider', () => {
    const handleChange = vi.fn()
    const { getByRole } = render(
      <VolumeControl
        volumePercent={40}
        isMuted={false}
        onChange={handleChange}
        onToggleMute={vi.fn()}
      />,
    )

    fireEvent.change(getByRole('slider', { name: 'Volume' }), { target: { value: '75' } })

    expect(handleChange).toHaveBeenCalledWith(75)
  })

  it('toggles mute, and says which way it will go', async () => {
    const user = userEvent.setup()
    const handleToggleMute = vi.fn()
    const { getByRole, rerender } = render(
      <VolumeControl
        volumePercent={40}
        isMuted={false}
        onChange={vi.fn()}
        onToggleMute={handleToggleMute}
      />,
    )

    await user.click(getByRole('button', { name: 'Mute' }))
    expect(handleToggleMute).toHaveBeenCalledOnce()

    rerender(
      <VolumeControl volumePercent={0} isMuted onChange={vi.fn()} onToggleMute={handleToggleMute} />,
    )
    expect(getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true')
  })
})
