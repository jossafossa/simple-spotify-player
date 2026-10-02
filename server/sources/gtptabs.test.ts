import { describe, expect, it, vi } from 'vitest'
import type { FetchPage } from '../types.ts'
import { gtptabsFiles, parseGtptabsListings, searchGtptabs, splitGtptabsVersion } from './gtptabs.ts'

const listing = (format: string, path: string, text: string, itemId: string, stars: number, kilobytes: string) => `
    <div class="autorSong ${format}">
        <div class="typeIco">&nbsp;</div>
        <div class="title">
                            <a href="${path}">${text}</a>
                <div class="ratingSmall " data-model="Tab" data-item="${itemId}" data-class="ratingSmall">
                ${'<a class="realActive active">1</a>'.repeat(stars)}
                <a >5</a>
            </div>
        </div>
        <div class="songInfo">
            (${kilobytes} Kb)
        </div>
    </div>`

const titleSearch = [
  listing('gp5', '/tabs/13/michael-schenker-group/captain-nemo-2.html', 'Michael Schenker Group - Captain Nemo (2)', '74413', 2, '3.70'),
  listing('gp4', '/tabs/14/nightwish/nemo.html', 'Nightwish - Nemo', '12952', 3, '38.71'),
].join('')

const artistSearch = '<a href="/tabs/14/nightwish.html">Nightwish</a><a href="/tabs/14/nightwish-tribute.html">x</a>'

const artistPage = [
  listing('gp4', '/tabs/14/nightwish/nemo.html', 'Nemo', '12952', 3, '38.71'),
  listing('gp4', '/tabs/14/nightwish/nemo-2.html', 'Nemo (2)', '12956', 4, '22.56'),
  listing('gpx', '/tabs/14/nightwish/amaranth.html', 'Amaranth', '13000', 1, '50.00'),
].join('')

describe('gtptabs', () => {
  it('reads format, page, number, stars and size from a listing', () => {
    expect(parseGtptabsListings(titleSearch)[1]).toEqual({
      text: 'Nightwish - Nemo',
      path: '/tabs/14/nightwish/nemo.html',
      itemId: '12952',
      format: 'gp4',
      stars: 3,
      sizeBytes: 39639,
    })
  })

  it('treats a number in brackets as a version of the song', () => {
    expect(splitGtptabsVersion('Nemo (2)')).toEqual({ name: 'Nemo', version: 2 })
    expect(splitGtptabsVersion('Nemo (cover)')).toEqual({ name: 'Nemo (cover)', version: undefined })
  })

  it('searches the title and the artist page, without duplicates, best first', async () => {
    const fetchPage: FetchPage = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('searchIn%5D=tab')
          ? titleSearch
          : url.includes('searchIn%5D=artist')
            ? artistSearch
            : url.endsWith('/tabs/14/nightwish.html')
              ? artistPage
              : '',
      ),
    )

    const results = await searchGtptabs({ artist: 'Nightwish', title: 'Nemo' }, fetchPage)

    expect(results.map((tab) => [tab.artist, tab.title, tab.kind])).toEqual([
      ['Nightwish', 'Nemo', 'Guitar Pro 4'],
      ['Nightwish', 'Nemo', 'Guitar Pro 4 · version 2'],
      ['Michael Schenker Group', 'Captain Nemo', 'Guitar Pro 5 · version 2'],
    ])
    expect(results[0]).toMatchObject({
      id: 'gtptabs:12952',
      url: 'https://gtptabs.com/tabs/14/nightwish/nemo.html',
      downloadPath: '/tabs/download/12952.html',
      rating: 3,
      sizeBytes: 39639,
    })
  })

  it('downloads a file by its number, under its own name', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Disposition': 'attachment; filename=nightwish-nemo.gp4' },
        }),
      ),
    )

    const file = await gtptabsFiles.fetchFile('/tabs/download/12952.html', fetchImpl as unknown as typeof fetch)

    expect(fetchImpl).toHaveBeenCalledWith('https://gtptabs.com/tabs/download/12952.html', expect.anything())
    expect(file.fileName).toBe('nightwish-nemo.gp4')
    expect(gtptabsFiles.pathPattern.test('/tabs/download/12952.html')).toBe(true)
    expect(gtptabsFiles.pathPattern.test('/../admin')).toBe(false)
  })
})
