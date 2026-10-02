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
    onVolumeUp: vi.fn(),
    onVolumeDown: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleShuffle: vi.fn(),
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

  it('changes volume on ArrowUp and ArrowDown and mutes on m', async () => {
    const user = userEvent.setup()
    renderHook(() => useKeyboardControls(handlers))

    await user.keyboard('{ArrowUp}{ArrowDown}m')

    expect(handlers.onVolumeUp).toHaveBeenCalledOnce()
    expect(handlers.onVolumeDown).toHaveBeenCalledOnce()
    expect(handlers.onToggleMute).toHaveBeenCalledOnce()
  })

  it('toggles shuffle on s', async () => {
    const user = userEvent.setup()
    renderHook(() => useKeyboardControls(handlers))

    await user.keyboard('s')

    expect(handlers.onToggleShuffle).toHaveBeenCalledOnce()
  })

  it('leaves the arrow keys to a focused select', async () => {
    const user = userEvent.setup()
    document.body.innerHTML = '<select><option>a</option><option>b</option></select>'
    const select = document.querySelector('select')!
    renderHook(() => useKeyboardControls(handlers))

    select.focus()
    await user.keyboard('{ArrowDown}')

    expect(handlers.onVolumeDown).not.toHaveBeenCalled()

    document.body.innerHTML = ''
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
