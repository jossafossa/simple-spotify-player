import { useEffect, useRef, useState } from 'react'
import { bpmFromTaps } from '~/lib/tempo'

/** A pause this long between taps starts a new count. */
const TAP_RESET_MS = 2000
const TAP_KEY = 't'

const isTypingIntoField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

export type UseTapTempoResult = {
  tap: () => void
  /** How many taps the current run has, or 0 between runs. */
  tapCount: number
}

/**
 * Turns taps on the beat into a tempo, averaged over the whole run and
 * refined with every tap. The T key taps too, since a key can be hit on the
 * beat more precisely than a button found with the mouse.
 */
export const useTapTempo = (onBpm: (bpm: number) => void): UseTapTempoResult => {
  const tapsRef = useRef<number[]>([])
  const [tapCount, setTapCount] = useState(0)

  const tap = () => {
    const now = performance.now()
    const last = tapsRef.current[tapsRef.current.length - 1]
    if (last !== undefined && now - last > TAP_RESET_MS) {
      tapsRef.current = []
    }

    tapsRef.current = [...tapsRef.current, now]
    setTapCount(tapsRef.current.length)
    const bpm = bpmFromTaps(tapsRef.current)
    if (bpm !== undefined) {
      onBpm(bpm)
    }
  }

  // The count goes once the run is over, so it never shows a stale run.
  useEffect(() => {
    if (tapCount === 0) {
      return
    }

    const timeout = window.setTimeout(() => {
      tapsRef.current = []
      setTapCount(0)
    }, TAP_RESET_MS)
    return () => window.clearTimeout(timeout)
  }, [tapCount])

  const tapRef = useRef(tap)

  useEffect(() => {
    tapRef.current = tap
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== TAP_KEY || event.repeat || isTypingIntoField(event.target)) {
        return
      }

      tapRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { tap, tapCount }
}
