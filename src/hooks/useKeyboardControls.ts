import { useEffect, useRef } from 'react'

export type KeyboardControlHandlers = {
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onSeekBackward: () => void
  onSeekForward: () => void
  onVolumeUp: () => void
  onVolumeDown: () => void
  onToggleMute: () => void
  onToggleShuffle: () => void
}

const isTypingIntoField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  // A focused select or slider already answers the arrow keys itself.
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

/**
 * Keeps the latest handlers in a ref so the listener is registered once,
 * instead of re-registering on every render as caller callbacks change.
 */
/** A dialog owns the keyboard while it is open, wherever focus has ended up. */
const isModalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null

export const useKeyboardControls = (handlers: KeyboardControlHandlers): void => {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingIntoField(event.target) || isModalOpen()) {
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
        case 'ArrowUp':
          event.preventDefault()
          handlersRef.current.onVolumeUp()
          break
        case 'ArrowDown':
          event.preventDefault()
          handlersRef.current.onVolumeDown()
          break
        case 'm':
          handlersRef.current.onToggleMute()
          break
        case 's':
          handlersRef.current.onToggleShuffle()
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
