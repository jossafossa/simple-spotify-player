import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBackButtonCloses } from './useBackButtonCloses'

const pressBack = async () => {
  const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
  act(() => window.history.back())
  await act(async () => {
    await popped
  })
}

type Props = { close: (() => void) | undefined }

const renderLayers = (close: (() => void) | undefined) =>
  renderHook((props: Props) => useBackButtonCloses(props.close), { initialProps: { close } })

describe('useBackButtonCloses', () => {
  it('leaves history alone while nothing is open', () => {
    const length = window.history.length

    renderLayers(undefined)

    expect(window.history.length).toBe(length)
  })

  it('closes the open layer on back, without leaving the page', async () => {
    const close = vi.fn()
    const startLength = window.history.length

    const { rerender } = renderLayers(undefined)
    rerender({ close })
    expect(window.history.length).toBe(startLength + 1)

    await pressBack()

    expect(close).toHaveBeenCalledOnce()
  })

  it('closes one layer per press while more are open', async () => {
    const closePicker = vi.fn()
    const closeViewer = vi.fn()
    const { rerender } = renderLayers(closePicker)

    await pressBack()
    expect(closePicker).toHaveBeenCalledOnce()

    // The picker is gone; the viewer under it is now the topmost layer.
    rerender({ close: closeViewer })
    await pressBack()

    expect(closeViewer).toHaveBeenCalledOnce()
    expect(closePicker).toHaveBeenCalledOnce()
  })

  it('takes its entry off when the last layer is closed some other way', async () => {
    const close = vi.fn()
    const back = vi.spyOn(window.history, 'back')
    const { rerender } = renderLayers(close)

    rerender({ close: undefined })
    await waitFor(() => expect(back).toHaveBeenCalledOnce())

    expect(close).not.toHaveBeenCalled()
    back.mockRestore()
  })
})
