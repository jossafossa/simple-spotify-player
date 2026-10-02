import { useEffect, useRef } from 'react'
import { bpmFromTaps } from '~/lib/tempo'

/** A pause this long between taps starts a new count. */
const TAP_RESET_MS = 2000

const TAP_KEY = 't'

const isTypingIntoField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

/**
 * Turns taps on the beat into a tempo, reported from the second tap on and
 * refined with every tap after. The T key taps too, since a key can be hit
 * on the beat more precisely than a button found with the mouse.
 */
export const useTapTempo = (onBpm: (bpm: number) => void): (() => void) => {
  const tapsRef = useRef<number[]>([])

  const tap = () => {
    const now = performance.now()
    const last = tapsRef.current[tapsRef.current.length - 1]
    if (last !== undefined && now - last > TAP_RESET_MS) {
      tapsRef.current = []
    }

    tapsRef.current = [...tapsRef.current, now].slice(-16)
    const bpm = bpmFromTaps(tapsRef.current)
    if (bpm !== undefined) {
      onBpm(bpm)
    }
  }
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

  return tap
}
