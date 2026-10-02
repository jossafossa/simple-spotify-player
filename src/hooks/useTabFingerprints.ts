import { useEffect, useRef, useState } from 'react'
import { readTabData } from '~/lib/tabDatabase'
import { fingerprintPossibleDuplicates } from '~/lib/tabDuplicates'
import type { TabFile } from '~/lib/types'

/**
 * Fingerprints of the library tabs that may be copies of each other, or of
 * a file of one of the other sizes, worked out again whenever a tab comes or
 * goes. Empty until they are in.
 */
export const useTabFingerprints = (tabs: TabFile[], otherSizes: number[] = []): Record<string, string> => {
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({})
  const tabsRef = useRef(tabs)
  // What the fingerprints depend on; the array itself is new after every
  // library change, renames included.
  const tabsKey = tabs.map((tab) => `${tab.id}:${tab.sizeBytes}`).join('|')
  const sizesKey = [...new Set(otherSizes)].sort((a, b) => a - b).join(',')

  useEffect(() => {
    tabsRef.current = tabs
  })

  useEffect(() => {
    let isCancelled = false

    fingerprintPossibleDuplicates(tabsRef.current, readTabData, sizesKey ? sizesKey.split(',').map(Number) : [])
      .then((next) => {
        if (!isCancelled) {
          setFingerprints(next)
        }
      })
      .catch((error: unknown) => console.error('Could not compare the library’s tab files', error))

    return () => {
      isCancelled = true
    }
  }, [tabsKey, sizesKey])

  return fingerprints
}
