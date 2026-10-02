import { useEffect, useState } from 'react'
import { readTabData } from '~/lib/tabDatabase'

export type TabDataStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export type UseTabDataResult = {
  status: TabDataStatus
  data: ArrayBuffer | undefined
}

type Loaded = {
  tabId: string
  status: Exclude<TabDataStatus, 'idle' | 'loading'>
  data: ArrayBuffer | undefined
}

/** Reads one tab file's bytes, only when it is opened. */
export const useTabData = (tabId: string | undefined): UseTabDataResult => {
  const [loaded, setLoaded] = useState<Loaded>()

  useEffect(() => {
    if (!tabId) {
      return
    }

    let isCancelled = false

    readTabData(tabId)
      .then((data) => {
        if (!isCancelled) {
          setLoaded({ tabId, status: data ? 'ready' : 'missing', data })
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          console.error('Could not read the tab file', error)
          setLoaded({ tabId, status: 'error', data: undefined })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [tabId])

  if (!tabId) {
    return { status: 'idle', data: undefined }
  }

  if (loaded?.tabId !== tabId) {
    return { status: 'loading', data: undefined }
  }

  return { status: loaded.status, data: loaded.data }
}
