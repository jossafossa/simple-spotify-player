import { useEffect, useRef } from 'react'

const OVERLAY_STATE = { 'spotify-player:overlay': true }

/**
 * Lets the browser's back button close what is open on top of the player,
 * one layer per press, instead of leaving the site. While anything is open,
 * one history entry stands for it; closing the last layer some other way
 * takes that entry off again, so back never has to be pressed twice.
 *
 * @param closeTopmost Closes the topmost layer; undefined while none is open.
 */
export const useBackButtonCloses = (closeTopmost: (() => void) | undefined): void => {
  const isOpen = closeTopmost !== undefined
  const closeTopmostRef = useRef(closeTopmost)
  const isOpenRef = useRef(isOpen)
  const hasEntryRef = useRef(false)
  // Set while the entry is being taken off, so that back is not taken for
  // the user's.
  const isRemovingEntryRef = useRef(false)

  useEffect(() => {
    closeTopmostRef.current = closeTopmost
    isOpenRef.current = isOpen

    if (isOpen && !hasEntryRef.current) {
      window.history.pushState(OVERLAY_STATE, '')
      hasEntryRef.current = true
      return
    }

    if (!isOpen && hasEntryRef.current) {
      hasEntryRef.current = false
      isRemovingEntryRef.current = true
      window.history.back()
    }
  })

  useEffect(() => {
    const handlePopState = () => {
      if (isRemovingEntryRef.current) {
        isRemovingEntryRef.current = false
        // Something opened again before the entry was off.
        if (isOpenRef.current && !hasEntryRef.current) {
          window.history.pushState(OVERLAY_STATE, '')
          hasEntryRef.current = true
        }
        return
      }

      if (!hasEntryRef.current) {
        return
      }

      // The layer under it, if any, gets an entry of its own on the next render.
      hasEntryRef.current = false
      closeTopmostRef.current?.()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
}
