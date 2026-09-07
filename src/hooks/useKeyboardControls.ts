import { useEffect, useRef } from 'react'

export type KeyboardControlHandlers = {
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onSeekBackward: () => void
  onSeekForward: () => void
}

const isTypingIntoField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

/**
 * Keeps the latest handlers in a ref so the listener is registered once,
 * instead of re-registering on every render as caller callbacks change.
 */
export const useKeyboardControls = (handlers: KeyboardControlHandlers): void => {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingIntoField(event.target)) {
        return
      }

      switch (event.key) {
        case ' ':
          event.preventDefault()
          handlersRef.current.onTogglePlay()
          break
        case 'ArrowRight':
          event.preventDefault()
          handlersRef.current.onSeekForward()
          break
        case 'ArrowLeft':
          event.preventDefault()
          handlersRef.current.onSeekBackward()
          break
        case 'n':
          handlersRef.current.onNext()
          break
        case 'p':
          handlersRef.current.onPrevious()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
