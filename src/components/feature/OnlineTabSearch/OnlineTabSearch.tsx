import { useState } from 'react'
import type { OnlineSearchState } from '~/hooks/useOnlineTabSearch'
import { sourceName, type OnlineSearchQuery, type OnlineTab } from '~/lib/onlineTabSearch'
import { buildTabSearchLinks } from '~/lib/tabSearchLinks'
import type { SongRef } from '~/lib/types'
import styles from './OnlineTabSearch.module.scss'

type OnlineTabSearchProps = {
  song: SongRef
  /** What the fields start with: the song's artist and its cleaned-up title. */
  initialQuery: OnlineSearchQuery
  state: OnlineSearchState
  /** Results being downloaded into the library right now, by id. */
  addingIds: string[]
  /** Results already added during this visit, by id. */
  addedIds: string[]
  onSearch: (query: OnlineSearchQuery) => void
  onAdd: (tab: OnlineTab) => void
}

const describe = (tab: OnlineTab): string =>
  [
    tab.kind.startsWith('Songsterr') ? tab.kind.replace(/^Songsterr · /, '') : tab.kind,
    tab.rating !== undefined ? `★ ${tab.rating}` : undefined,
    tab.votes ? `${tab.votes} votes` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

const ResultRow = ({
  tab,
  action,
}: {
  tab: OnlineTab
  action: React.ReactNode
}) => (
  <li className={styles.row}>
    <span className={styles.text}>
      <span className={styles.title}>
        {tab.title} <span className={styles.artist}>— {tab.artist}</span>
      </span>
      <span className={styles.meta}>
        <span className={styles.source}>{sourceName(tab.source)}</span> {describe(tab)}
      </span>
    </span>
    {action}
  </li>
)

/**
 * Tab sites searched through the app's own tab search service. Files that
 * can be fetched freely are added to the library in one click; the rest open
 * on their site, which needs an account there to download.
 */
export const OnlineTabSearch = ({
  song,
  initialQuery,
  state,
  addingIds,
  addedIds,
  onSearch,
  onAdd,
}: OnlineTabSearchProps) => {
  const [artist, setArtist] = useState(initialQuery.artist)
  const [title, setTitle] = useState(initialQuery.title)
  const results = state.kind === 'done' ? state.results : []
  const downloadable = results.filter((tab) => tab.downloadPath)
  const linkOnly = results.filter((tab) => !tab.downloadPath)

  return (
    <section className={styles.section} aria-label="Search online">
      <h3 className={styles.heading}>Search online</h3>
      <form
        className={styles.form}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim()) {
            onSearch({ artist: artist.trim(), title: title.trim() })
          }
        }}
      >
        <input
          className={styles.field}
          aria-label="Artist"
          placeholder="Artist"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
        />
        <input
          className={styles.field}
          aria-label="Song title"
          placeholder="Song title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={!title.trim() || state.kind === 'searching'}
        >
          {state.kind === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {state.kind === 'idle' && (
        <p className={styles.hint}>
          Searches GProTab, Songsterr and Ultimate Guitar. Free Guitar Pro files
          are added in one click.
        </p>
      )}

      {state.kind === 'unavailable' && (
        <div className={styles.notice} role="status">
          <p className={styles.noticeText}>
            The tab search service is not running. Start the app with <code>pnpm dev</code> or{' '}
            <code>docker compose up</code>. Meanwhile, search on the sites themselves:
          </p>
          <p className={styles.links}>
            {buildTabSearchLinks(song).map((link) => (
              <a key={link.site} className={styles.open} href={link.url} target="_blank" rel="noreferrer">
                {link.site} ↗
              </a>
            ))}
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}

      {state.kind === 'done' && results.length === 0 && (
        <p className={styles.empty}>
          No tabs found for “{state.query.title}”
          {state.query.artist && ` by ${state.query.artist}`}. Try a shorter title.
        </p>
      )}

      {downloadable.length > 0 && (
        <div className={styles.group}>
          <h4 className={styles.subheading}>Free to download</h4>
          <ul className={styles.list}>
            {downloadable.map((tab) => {
              const isAdding = addingIds.includes(tab.id)
              const isAdded = addedIds.includes(tab.id)
              return (
                <ResultRow
                  key={tab.id}
                  tab={tab}
                  action={
                    <button
                      type="button"
                      className={styles.add}
                      disabled={isAdding || isAdded}
                      onClick={() => onAdd(tab)}
                      aria-label={`Add ${tab.title} (${tab.kind}) from ${sourceName(tab.source)}`}
                    >
                      {isAdded ? 'Added' : isAdding ? 'Adding…' : 'Add'}
                    </button>
                  }
                />
              )
            })}
          </ul>
        </div>
      )}

      {linkOnly.length > 0 && (
        <div className={styles.group}>
          <h4 className={styles.subheading}>On other sites — download there, then upload</h4>
          <ul className={styles.list}>
            {linkOnly.map((tab) => (
              <ResultRow
                key={tab.id}
                tab={tab}
                action={
                  <a className={styles.open} href={tab.url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                }
              />
            ))}
          </ul>
        </div>
      )}

      {state.kind === 'done' && state.failures.length > 0 && (
        <p className={styles.hint}>
          Could not reach {state.failures.map((failure) => sourceName(failure.source)).join(', ')}{' '}
          this time.
        </p>
      )}
    </section>
  )
}
