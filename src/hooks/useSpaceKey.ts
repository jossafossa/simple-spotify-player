import { useEffect, useRef } from 'react'

const isTypingIntoField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

const isModalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null

/**
 * While given a handler, Space goes to it instead of to the player's own
 * play/pause shortcut: listening in the capture phase on window, it runs
 * before that shortcut and keeps the key from reaching it.
 */
export const useSpaceKey = (onSpace: (() => void) | undefined): void => {
  const onSpaceRef = useRef(onSpace)
  const isActive = onSpace !== undefined

  useEffect(() => {
    onSpaceRef.current = onSpace
  })

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' || isTypingIntoField(event.target) || isModalOpen()) {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      onSpaceRef.current?.()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isActive])
}
