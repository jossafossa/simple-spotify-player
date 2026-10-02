import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OnlineSearchState } from '~/hooks/useOnlineTabSearch'
import type { OnlineTab } from '~/lib/onlineTabSearch'
import { OnlineTabSearch } from './OnlineTabSearch'

const song = { uri: 'spotify:track:nemo', name: 'Nemo - Remastered', artistNames: ['Nightwish'] }
const query = { artist: 'Nightwish', title: 'Nemo' }

const buildTab = (overrides: Partial<OnlineTab>): OnlineTab => ({
  id: 'gprotab:/en/tabs/nightwish/nemo',
  source: 'gprotab',
  artist: 'Nightwish',
  title: 'Nemo',
  kind: 'Guitar Pro',
  url: 'https://gprotab.net/en/tabs/nightwish/nemo',
  downloadPath: '/en/tabs/nightwish/nemo',
  rating: undefined,
  votes: undefined,
  relevance: 1,
  ...overrides,
})

const free = buildTab({})
const free2 = buildTab({ id: 'gprotab:2', kind: 'Guitar Pro · version 2', downloadPath: '/en/tabs/nightwish/nemo-2' })
const ug = buildTab({
  id: 'ultimate-guitar:248701',
  source: 'ultimate-guitar',
  url: 'https://tabs.ultimate-guitar.com/tab/nightwish/nemo-guitar-pro-248701',
  downloadPath: undefined,
  rating: 4.5,
  votes: 51,
})

const renderSearch = (state: OnlineSearchState, props: Partial<React.ComponentProps<typeof OnlineTabSearch>> = {}) => {
  const handlers = { onSearch: vi.fn(), onAdd: vi.fn() }
  const view = render(
    <OnlineTabSearch
      song={song}
      initialQuery={query}
      state={state}
      addingIds={[]}
      addedIds={[]}
      {...handlers}
      {...props}
    />,
  )
  return { ...view, ...handlers }
}

describe('OnlineTabSearch', () => {
  it('starts from the song, and searches what is typed', async () => {
    const user = userEvent.setup()
    const { getByRole, onSearch } = renderSearch({ kind: 'idle' })
    const title = getByRole('textbox', { name: 'Song title' })

    expect(getByRole('textbox', { name: 'Artist' })).toHaveValue('Nightwish')
    expect(title).toHaveValue('Nemo')

    await user.clear(title)
    await user.type(title, 'Amaranth{Enter}')

    expect(onSearch).toHaveBeenCalledWith({ artist: 'Nightwish', title: 'Amaranth' })
  })

  it('explains what it searches before the first search', () => {
    const { getByText } = renderSearch({ kind: 'idle' })

    expect(getByText(/Searches GProTab, Songsterr and Ultimate Guitar/)).toBeInTheDocument()
  })

  it('cannot search without a title, or while searching', async () => {
    const user = userEvent.setup()
    const { getByRole, rerender } = renderSearch({ kind: 'idle' })

    await user.clear(getByRole('textbox', { name: 'Song title' }))
    expect(getByRole('button', { name: 'Search' })).toBeDisabled()

    rerender(
      <OnlineTabSearch
        song={song}
        initialQuery={query}
        state={{ kind: 'searching', query }}
        addingIds={[]}
        addedIds={[]}
        onSearch={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    expect(getByRole('button', { name: 'Searching…' })).toBeDisabled()
  })

  it('adds free files in one click, and links the rest to their site', async () => {
    const user = userEvent.setup()
    const { getByRole, getByText, onAdd } = renderSearch({
      kind: 'done',
      query,
      results: [free, free2, ug],
      failures: [],
    })

    expect(getByText('Free to download')).toBeInTheDocument()
    await user.click(getByRole('button', { name: 'Add Nemo (Guitar Pro · version 2) from GProTab' }))
    expect(onAdd).toHaveBeenCalledWith(free2)

    const open = getByRole('link', { name: 'Open ↗' })
    expect(open).toHaveAttribute('href', ug.url)
    expect(open).toHaveAttribute('target', '_blank')
    expect(getByText(/★ 4.5 · 51 votes/)).toBeInTheDocument()
  })

  it('shows which results are being added or already are', () => {
    const { getByRole } = renderSearch(
      { kind: 'done', query, results: [free, free2], failures: [] },
      { addingIds: [free.id], addedIds: [free2.id] },
    )

    expect(getByRole('button', { name: /Add Nemo \(Guitar Pro\) from/ })).toHaveTextContent('Adding…')
    expect(getByRole('button', { name: /version 2/ })).toHaveTextContent('Added')
    expect(getByRole('button', { name: /version 2/ })).toBeDisabled()
  })

  it('says when nothing was found, and which sources could not be reached', () => {
    const { getByText } = renderSearch({
      kind: 'done',
      query,
      results: [],
      failures: [{ source: 'songsterr', message: 'down' }],
    })

    expect(getByText(/No tabs found for “Nemo” by Nightwish/)).toBeInTheDocument()
    expect(getByText(/Could not reach Songsterr/)).toBeInTheDocument()
  })

  it('falls back to links when the service is not running', () => {
    const { getByRole } = renderSearch({ kind: 'unavailable' })

    expect(getByRole('status')).toHaveTextContent('The tab search service is not running')
    expect(getByRole('link', { name: 'Songsterr ↗' })).toHaveAttribute(
      'href',
      'https://www.songsterr.com/?pattern=Nightwish%20Nemo%20-%20Remastered',
    )
  })

  it('shows an error from the service', () => {
    const { getByRole } = renderSearch({ kind: 'error', message: 'The tab search failed.' })

    expect(getByRole('alert')).toHaveTextContent('The tab search failed.')
  })
})
