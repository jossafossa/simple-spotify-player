import { describe, expect, it } from 'vitest'
import { UpstreamError } from '../fetchPage.ts'
import { parseUltimateGuitarSearch, searchUltimateGuitar } from './ultimateGuitar.ts'

const pageWith = (results: unknown[]) => {
  const json = JSON.stringify({ store: { page: { data: { results } } } }).replace(/"/g, '&quot;')
  return `<div class="js-store" data-content="${json}"></div>`
}

const result = (id: number, type: string, votes: number, song_name = 'Nemo') => ({
  id,
  type,
  song_name,
  artist_name: 'Nightwish',
  tab_url: `https://tabs.ultimate-guitar.com/tab/nightwish/nemo-${id}`,
  rating: 4.50748,
  votes,
})

describe('Ultimate Guitar', () => {
  it('reads the results embedded in the search page', () => {
    expect(parseUltimateGuitarSearch(pageWith([{ id: 1 }]))).toEqual([{ id: 1 }])
    expect(parseUltimateGuitarSearch('<html></html>')).toEqual([])
  })

  it('keeps Guitar Pro and Power Tab results, best voted first, at most six', async () => {
    const results = await searchUltimateGuitar({ artist: 'Nightwish', title: 'Nemo' }, () =>
      Promise.resolve(
        pageWith([
          result(1, 'Chords', 999),
          result(2, 'Pro', 5),
          result(3, 'Power', 50),
          ...[10, 11, 12, 13, 14, 15].map((id) => result(id, 'Pro', id)),
        ]),
      ),
    )

    expect(results).toHaveLength(6)
    expect(results[0]).toMatchObject({ id: 'ultimate-guitar:3', kind: 'Power Tab', rating: 4.5, votes: 50 })
    expect(results.some((tab) => tab.id === 'ultimate-guitar:1')).toBe(false)
    expect(results.every((tab) => tab.downloadPath === undefined)).toBe(true)
  })

  it('reads a 404 as no results', async () => {
    const results = await searchUltimateGuitar({ artist: '', title: 'Zzqx' }, () =>
      Promise.reject(new UpstreamError('https://www.ultimate-guitar.com/search.php', 404)),
    )

    expect(results).toEqual([])
  })
})
