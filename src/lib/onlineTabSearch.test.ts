import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanSongTitle,
  downloadOnlineTab,
  libraryNameFor,
  searchOnlineTabs,
  TabSearchUnavailableError,
  type OnlineTab,
} from './onlineTabSearch'

const tab: OnlineTab = {
  id: 'gprotab:/en/tabs/nightwish/nemo-2',
  source: 'gprotab',
  artist: 'Nightwish',
  title: 'Nemo',
  kind: 'Guitar Pro · version 2',
  url: 'https://gprotab.net/en/tabs/nightwish/nemo-2',
  downloadPath: '/en/tabs/nightwish/nemo-2',
  rating: undefined,
  votes: undefined,
  relevance: 1,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('cleanSongTitle', () => {
  it.each([
    ['Nemo - Remastered 2021', 'Nemo'],
    ['Wonderwall - Remastered', 'Wonderwall'],
    ['Bad Habits (feat. Someone)', 'Bad Habits'],
    ['Song [Live at Wembley]', 'Song'],
    ['Hey Jude - 2015 Mix', 'Hey Jude'],
    ['Sweet Child O’ Mine', 'Sweet Child O’ Mine'],
    ['Smells Like Teen Spirit', 'Smells Like Teen Spirit'],
  ])('%s → %s', (title, cleaned) => {
    expect(cleanSongTitle(title)).toBe(cleaned)
  })
})

it('names a download after the song, its source and version', () => {
  expect(libraryNameFor(tab)).toBe('Nemo · GProTab version 2')
  expect(libraryNameFor({ ...tab, kind: 'Guitar Pro' })).toBe('Nemo · GProTab')
})

describe('searchOnlineTabs', () => {
  it('asks the service for artist and title', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ results: [tab], failures: [] })))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchOnlineTabs({ artist: 'Nightwish', title: 'Nemo & more' })

    expect(fetchMock).toHaveBeenCalledWith('/api/tabs/search?artist=Nightwish&title=Nemo%20%26%20more')
    expect(result.results).toEqual([tab])
  })

  it('calls a separately hosted service at its URL', async () => {
    vi.stubEnv('VITE_TAB_SEARCH_URL', 'https://tabs.example.com/')
    const fetchMock = vi.fn(() => Promise.resolve(json({ results: [], failures: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await searchOnlineTabs({ artist: '', title: 'Nemo' })

    expect(fetchMock).toHaveBeenCalledWith('https://tabs.example.com/api/tabs/search?artist=&title=Nemo')
  })

  it('tells a missing service apart from a failing one', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(searchOnlineTabs({ artist: '', title: 'x' })).rejects.toBeInstanceOf(
      TabSearchUnavailableError,
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))),
    )
    await expect(searchOnlineTabs({ artist: '', title: 'x' })).rejects.toBeInstanceOf(
      TabSearchUnavailableError,
    )

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ error: 'A title is needed.' }, 400))))
    await expect(searchOnlineTabs({ artist: '', title: '' })).rejects.toThrow('A title is needed.')
  })
})

describe('downloadOnlineTab', () => {
  it('fetches the file through the service under its own name', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2]), {
          headers: { 'Content-Disposition': 'attachment; filename="nightwish-nemo_2.gp4"' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const file = await downloadOnlineTab(tab)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tabs/download?source=gprotab&path=%2Fen%2Ftabs%2Fnightwish%2Fnemo-2',
    )
    expect(file.name).toBe('nightwish-nemo_2.gp4')
    expect(file.size).toBe(2)
  })

  it('refuses a result that can only be opened on its site', async () => {
    await expect(downloadOnlineTab({ ...tab, downloadPath: undefined })).rejects.toThrow(
      /can only be opened/,
    )
  })

  it('reports a failed download', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ error: 'nope' }, 502))))

    await expect(downloadOnlineTab(tab)).rejects.toThrow('Could not download “Nemo”.')
  })
})
