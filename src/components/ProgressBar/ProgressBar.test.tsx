import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the formatted elapsed and total time', () => {
    render(<ProgressBar positionMs={65_000} durationMs={200_000} onSeek={vi.fn()} />)

    expect(screen.getByText('1:05')).toBeInTheDocument()
    expect(screen.getByText('3:20')).toBeInTheDocument()
  })

  it('exposes the position as an accessible progressbar value', () => {
    render(<ProgressBar positionMs={65_000} durationMs={200_000} onSeek={vi.fn()} />)

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '65000')
    expect(progressbar).toHaveAttribute('aria-valuemax', '200000')
  })

  it('seeks to the clicked ratio of the track width', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      height: 4,
      right: 200,
      bottom: 4,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    const handleSeek = vi.fn()

    render(<ProgressBar positionMs={0} durationMs={200_000} onSeek={handleSeek} />)

    fireEvent.click(screen.getByRole('progressbar'), { clientX: 100 })

    expect(handleSeek).toHaveBeenCalledWith(100_000)
  })
})
