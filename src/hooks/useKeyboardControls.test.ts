import { renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardControls } from './useKeyboardControls'

describe('useKeyboardControls', () => {
  const handlers = {
    onTogglePlay: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSeekBackward: vi.fn(),
    onSeekForward: vi.fn(),
  }

  beforeEach(() => {
    Object.values(handlers).forEach((handler) => handler.mockClear())
  })

  it('calls onTogglePlay on space', async () => {
    const user = userEvent.setup()
    renderHook(() => useKeyboardControls(handlers))

    await user.keyboard(' ')

    expect(handlers.onTogglePlay).toHaveBeenCalledOnce()
  })

  it('calls onSeekForward on ArrowRight and onSeekBackward on ArrowLeft', async () => {
    const user = userEvent.setup()
    renderHook(() => useKeyboardControls(handlers))

    await user.keyboard('{ArrowRight}{ArrowLeft}')

    expect(handlers.onSeekForward).toHaveBeenCalledOnce()
    expect(handlers.onSeekBackward).toHaveBeenCalledOnce()
  })

  it('calls onNext on n and onPrevious on p', async () => {
    const user = userEvent.setup()
    renderHook(() => useKeyboardControls(handlers))

    await user.keyboard('np')

    expect(handlers.onNext).toHaveBeenCalledOnce()
    expect(handlers.onPrevious).toHaveBeenCalledOnce()
  })

  it('ignores keystrokes while typing into a text field', async () => {
    const user = userEvent.setup()
    document.body.innerHTML = '<input type="text" />'
    const input = document.querySelector('input')!
    renderHook(() => useKeyboardControls(handlers))

    input.focus()
    await user.keyboard(' n p')

    expect(handlers.onTogglePlay).not.toHaveBeenCalled()
    expect(handlers.onNext).not.toHaveBeenCalled()
    expect(handlers.onPrevious).not.toHaveBeenCalled()

    document.body.innerHTML = ''
  })

  it('uses the latest handlers without re-registering the listener', async () => {
    const user = userEvent.setup()
    const { rerender } = renderHook(
      (props: typeof handlers) => useKeyboardControls(props),
      { initialProps: handlers },
    )

    const updatedOnTogglePlay = vi.fn()
    rerender({ ...handlers, onTogglePlay: updatedOnTogglePlay })

    await user.keyboard(' ')

    expect(updatedOnTogglePlay).toHaveBeenCalledOnce()
    expect(handlers.onTogglePlay).not.toHaveBeenCalled()
  })
})
