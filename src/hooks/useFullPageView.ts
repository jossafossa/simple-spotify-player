import { useEffect } from 'react'

/**
 * For a view that covers the whole page: the page underneath stops scrolling,
 * and Escape leaves the view — unless a dialog on top of it is open, which
 * then gets the Escape instead.
 */
export const useFullPageView = (onLeave: () => void): void => {
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    const leaveOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) {
        onLeave()
      }
    }

    window.addEventListener('keydown', leaveOnEscape)
    return () => window.removeEventListener('keydown', leaveOnEscape)
  }, [onLeave])
}
