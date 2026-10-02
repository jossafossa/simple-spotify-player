import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSpaceKey } from './useSpaceKey'

describe('useSpaceKey', () => {
  const playerShortcut = vi.fn()

  afterEach(() => {
    window.removeEventListener('keydown', playerShortcut)
    playerShortcut.mockClear()
  })

  it("takes Space before the player's own shortcut gets it", () => {
    window.addEventListener('keydown', playerShortcut)
    const onSpace = vi.fn()
    renderHook(() => useSpaceKey(onSpace))

    fireEvent.keyDown(document.body, { key: ' ' })

    expect(onSpace).toHaveBeenCalledOnce()
    expect(playerShortcut).not.toHaveBeenCalled()
  })

  it('leaves Space alone without a handler, and while typing', () => {
    window.addEventListener('keydown', playerShortcut)
    const onSpace = vi.fn()
    const { rerender } = renderHook((props: { onSpace?: () => void }) => useSpaceKey(props.onSpace), {
      initialProps: {},
    })

    fireEvent.keyDown(document.body, { key: ' ' })
    expect(playerShortcut).toHaveBeenCalledOnce()

    rerender({ onSpace })
    const input = document.createElement('input')
    document.body.append(input)
    fireEvent.keyDown(input, { key: ' ' })
    input.remove()

    expect(onSpace).not.toHaveBeenCalled()
  })
})
