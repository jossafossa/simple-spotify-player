import { describe, expect, it, vi } from 'vitest'
import {
  findTheguitarlessonFile,
  searchTheguitarlesson,
  splitPostTitle,
  theguitarlessonFiles,
} from './theguitarlesson.ts'

const hits = JSON.stringify([
  { title: 'Nemo (2) &#8211; Nightwish', url: 'https://www.theguitarlesson.com/guitar-pro-tabs/n/nightwish/nemo-2-nightwish/' },
  { title: 'Nemo &#8211; Nightwish', url: 'https://www.theguitarlesson.com/guitar-pro-tabs/n/nightwish/nemo-nightwish/' },
  { title: 'Nemo &#8211; Nightwish', url: 'https://www.theguitarlesson.com/guitar-pro-tabs/n/nightwish/nemo-nightwish/' },
  { title: 'Amaranth &#8211; Nightwish', url: 'https://www.theguitarlesson.com/guitar-pro-tabs/n/nightwish/amaranth-nightwish/' },
  { title: 'Elsewhere', url: 'https://example.com/n/nightwish/x/' },
])

describe('theguitarlesson.com', () => {
  it('splits the artist off the end of a post title', () => {
    expect(splitPostTitle('One &#8211; S&#038;M &#8211; Metallica')).toEqual({ artist: 'Metallica', title: 'One – S&M' })
  })

  it('searches artist and title together, once per post, best first', async () => {
    const fetchPage = vi.fn(() => Promise.resolve(hits))

    const results = await searchTheguitarlesson({ artist: 'Nightwish', title: 'Nemo' }, fetchPage)

    expect(fetchPage).toHaveBeenCalledWith(
      'https://www.theguitarlesson.com/guitar-pro-tabs/wp-json/wp/v2/search?search=Nightwish%20Nemo&per_page=20',
    )
    expect(results.map((tab) => [tab.title, tab.kind])).toEqual([
      ['Nemo', 'Guitar Pro · version 2'],
      ['Nemo', 'Guitar Pro'],
    ])
    expect(results[1]!.downloadPath).toBe('/guitar-pro-tabs/n/nightwish/nemo-nightwish/')
  })

  it('finds the file the post links, spaces escaped', () => {
    const html = '<a href="https://www.theguitarlesson.com/guitar-pro-tabs/song-files/Nightwish - Nemo.gp4">Download</a>'

    expect(findTheguitarlessonFile(html)).toBe(
      'https://www.theguitarlesson.com/guitar-pro-tabs/song-files/Nightwish%20-%20Nemo.gp4',
    )
    expect(findTheguitarlessonFile('<a href="https://elsewhere.example/x.gp4">')).toBeUndefined()
  })

  it('downloads the file the post links, named after it', async () => {
    const fetchImpl = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('song-files')
          ? new Response(new Uint8Array([1, 2]))
          : new Response(
              '<a href="https://www.theguitarlesson.com/guitar-pro-tabs/song-files/Nightwish - Nemo.gp4">x</a>',
            ),
      ),
    )

    const file = await theguitarlessonFiles.fetchFile(
      '/guitar-pro-tabs/n/nightwish/nemo-nightwish/',
      fetchImpl as unknown as typeof fetch,
    )

    expect(file.fileName).toBe('Nightwish - Nemo.gp4')
    expect(file.data).toEqual(new Uint8Array([1, 2]))
  })
})
