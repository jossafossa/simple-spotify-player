import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('is a labelled dialog that takes focus', () => {
    const { getByRole } = render(
      <Modal title="Tab library" subtitle="2 songs" onClose={vi.fn()}>
        <p>Body</p>
      </Modal>,
    )

    const dialog = getByRole('dialog', { name: 'Tab library' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
    expect(getByRole('dialog')).toHaveTextContent('2 songs')
  })

  it('closes on the close button, on Escape even with focus outside, and on the backdrop', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    const { getByRole } = render(
      <Modal title="Tabs" onClose={handleClose}>
        <p>Body</p>
      </Modal>,
    )

    await user.click(getByRole('button', { name: 'Close' }))
    expect(handleClose).toHaveBeenCalledTimes(1)

    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Escape}')
    expect(handleClose).toHaveBeenCalledTimes(2)

    await user.click(getByRole('dialog').parentElement!)
    expect(handleClose).toHaveBeenCalledTimes(3)
  })

  it('does not close when clicking inside', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    const { getByText } = render(
      <Modal title="Tabs" onClose={handleClose}>
        <p>Body</p>
      </Modal>,
    )

    await user.click(getByText('Body'))

    expect(handleClose).not.toHaveBeenCalled()
  })
})
