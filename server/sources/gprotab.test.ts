import { describe, expect, it } from 'vitest'
import type { FetchPage } from '../types.ts'
import { parseGprotabArtist, parseGprotabSearch, searchGprotab, splitVersion } from './gprotab.ts'

const searchPage = `
  <div class="tab search-tab">
    <div class="tab-data">
      <a href="/en/tabs/michael-schenker-group" class="tab-band">Michael schenker group</a>
      <a href="/en/tabs/michael-schenker-group/captain-nemo" class="tab-name">Captain nemo</a>
    </div>
  </div>
  <div class="tab search-tab">
    <div class="tab-data">
      <a href="/en/tabs/nightwish" class="tab-band">Nightwish</a>
      <a href="/en/tabs/nightwish/nemo" class="tab-name">Nemo</a>
    </div>
  </div>`

const artistPage = `
  <a href="/en/tabs/nightwish/amaranth">Amaranth</a>
  <a href="/en/tabs/nightwish/nemo">Nemo</a>
  <a href="/en/tabs/nightwish/nemo-2">Nemo 2</a>
  <a href="/en/tabs/nightwish/nemo-cover">Nemo cover</a>`

describe('GProTab', () => {
  it('reads artist and title pairs from the search page', () => {
    expect(parseGprotabSearch(searchPage)).toEqual([
      { artist: 'Michael schenker group', title: 'Captain nemo', path: '/en/tabs/michael-schenker-group/captain-nemo' },
      { artist: 'Nightwish', title: 'Nemo', path: '/en/tabs/nightwish/nemo' },
    ])
  })

  it('reads every song from an artist page', () => {
    expect(parseGprotabArtist(artistPage, 'nightwish', 'Nightwish').map((song) => song.title)).toEqual([
      'Amaranth',
      'Nemo',
      'Nemo 2',
      'Nemo cover',
    ])
  })

  it('treats a trailing number as a version of the song', () => {
    expect(splitVersion('Nemo 2')).toEqual({ name: 'Nemo', version: 2 })
    expect(splitVersion('Nemo cover')).toEqual({ name: 'Nemo cover', version: undefined })
  })

  it('searches the title and the artist page, without duplicates, best first', async () => {
    const requested: string[] = []
    const fetchPage: FetchPage = (url) => {
      requested.push(url)
      return Promise.resolve(url.includes('/search') ? searchPage : artistPage)
    }

    const results = await searchGprotab({ artist: 'Nightwish', title: 'Nemo' }, fetchPage)

    expect(requested).toEqual([
      'https://gprotab.net/en/search?q=Nemo',
      'https://gprotab.net/en/tabs/nightwish',
    ])
    expect(results.map((tab) => [tab.title, tab.kind, tab.downloadPath])).toEqual([
      ['Nemo', 'Guitar Pro', '/en/tabs/nightwish/nemo'],
      ['Nemo', 'Guitar Pro · version 2', '/en/tabs/nightwish/nemo-2'],
      ['Nemo cover', 'Guitar Pro', '/en/tabs/nightwish/nemo-cover'],
      ['Captain nemo', 'Guitar Pro', '/en/tabs/michael-schenker-group/captain-nemo'],
    ])
    expect(results[0]!.relevance).toBe(1)
    expect(results[3]!.relevance).toBeLessThan(0.5)
  })

  it('still searches when the artist has no page', async () => {
    const fetchPage: FetchPage = (url) =>
      url.includes('/search') ? Promise.resolve(searchPage) : Promise.reject(new Error('404'))

    const results = await searchGprotab({ artist: 'Nightwish', title: 'Nemo' }, fetchPage)

    expect(results.map((tab) => tab.title)).toContain('Nemo')
  })
})
