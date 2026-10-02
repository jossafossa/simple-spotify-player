import { describe, expect, it, vi } from 'vitest'
import { UpstreamError } from '../fetchPage.ts'
import {
  findUltimateGuitarBinaryId,
  parseUltimateGuitarSearch,
  searchUltimateGuitar,
  ultimateGuitarFiles,
} from './ultimateGuitar.ts'

const storeOf = (data: unknown) => {
  const json = JSON.stringify({ store: { page: { data } } }).replace(/"/g, '&quot;')
  return `<div class="js-store" data-content="${json}"></div>`
}
const pageWith = (results: unknown[]) => storeOf({ results })
const BINARY_ID = '%2B8c6KY4afu4nmHX9K9rOEjZi%3D%3D'

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

  it('makes a public tab downloadable, and leaves official and paid tabs as links', async () => {
    const results = await searchUltimateGuitar({ artist: 'Nightwish', title: 'Nemo' }, () =>
      Promise.resolve(
        pageWith([
          { ...result(1, 'Pro', 3), tab_access_type: 'public' },
          { ...result(2, 'Pro', 2), tab_access_type: 'private' },
          { ...result(3, 'Pro', 1), tab_access_type: 'public', tab_url: 'https://elsewhere.example/tab/x/y-3' },
        ]),
      ),
    )

    expect(results.map((tab) => tab.downloadPath)).toEqual(['/tab/nightwish/nemo-1', undefined, undefined])
  })

  it('tells the uploads of one song apart by version', async () => {
    const results = await searchUltimateGuitar({ artist: 'Nightwish', title: 'Nemo' }, () =>
      Promise.resolve(pageWith([{ ...result(1, 'Pro', 2), version: 1 }, { ...result(2, 'Pro', 1), version: 3 }])),
    )

    expect(results.map((tab) => tab.kind)).toEqual(['Guitar Pro', 'Guitar Pro · version 3'])
  })

  it("reads the file's download token from a tab page", () => {
    expect(findUltimateGuitarBinaryId(storeOf({ tab_view: { binary_id: BINARY_ID } }))).toBe(BINARY_ID)
    expect(findUltimateGuitarBinaryId(storeOf({ tab_view: { binary_id: 'x&y=1' } }))).toBeUndefined()
    expect(findUltimateGuitarBinaryId('<html></html>')).toBeUndefined()
  })

  it('downloads the file with the token, sent from the tab page', async () => {
    const fetchImpl = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/tab/download')
          ? new Response(new Uint8Array([1, 2]), {
              headers: {
                'Content-Disposition':
                  "attachment; filename=\"Doe Maar - Smoorverliefd (ver 3 by guitar_newbie).gpx\"; filename*=utf-8''x",
              },
            })
          : new Response(storeOf({ tab_view: { binary_id: BINARY_ID } })),
      ),
    )

    const file = await ultimateGuitarFiles.fetchFile(
      '/tab/doe-maar/smoorverliefd-guitar-pro-1456126',
      fetchImpl as unknown as typeof fetch,
    )

    expect(fetchImpl).toHaveBeenLastCalledWith(
      `https://tabs.ultimate-guitar.com/tab/download?id=${BINARY_ID}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Referer: 'https://tabs.ultimate-guitar.com/tab/doe-maar/smoorverliefd-guitar-pro-1456126',
        }),
      }),
    )
    expect(file.fileName).toBe('Doe Maar - Smoorverliefd (ver 3 by guitar_newbie).gpx')
  })

  it('says so when a tab page offers no file', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(storeOf({ tab_view: {} }))))

    await expect(
      ultimateGuitarFiles.fetchFile('/tab/nightwish/nemo-1', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('Ultimate Guitar offers no file')
  })

  it('reads a 404 as no results', async () => {
    const results = await searchUltimateGuitar({ artist: '', title: 'Zzqx' }, () =>
      Promise.reject(new UpstreamError('https://www.ultimate-guitar.com/search.php', 404)),
    )

    expect(results).toEqual([])
  })
})
