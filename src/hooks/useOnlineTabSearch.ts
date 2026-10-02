import { useState } from 'react'
import {
  searchOnlineTabs,
  TabSearchUnavailableError,
  type OnlineSearchQuery,
  type OnlineSearchResult,
} from '~/lib/onlineTabSearch'

export type OnlineSearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; query: OnlineSearchQuery }
  | ({ kind: 'done'; query: OnlineSearchQuery } & OnlineSearchResult)
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }

export type UseOnlineTabSearchResult = {
  state: OnlineSearchState
  search: (query: OnlineSearchQuery) => void
  reset: () => void
}

/** Searches tab sites through the app's tab search service. Only the latest search counts. */
export const useOnlineTabSearch = (): UseOnlineTabSearchResult => {
  const [state, setState] = useState<OnlineSearchState>({ kind: 'idle' })

  const search = (query: OnlineSearchQuery) => {
    setState({ kind: 'searching', query })

    searchOnlineTabs(query)
      .then((result) => {
        setState((current) =>
          current.kind === 'searching' && current.query === query
            ? { kind: 'done', query, ...result }
            : current,
        )
      })
      .catch((error: unknown) => {
        console.error('Online tab search failed', error)
        setState((current) => {
          if (current.kind !== 'searching' || current.query !== query) {
            return current
          }

          return error instanceof TabSearchUnavailableError
            ? { kind: 'unavailable' }
            : { kind: 'error', message: error instanceof Error ? error.message : 'The search failed.' }
        })
      })
  }

  return { state, search, reset: () => setState({ kind: 'idle' }) }
}
