import { describe, expect, it, vi } from 'vitest'
import { guitarprotabsFiles, parseGuitarprotabsSearch, searchGuitarprotabs } from './guitarprotabs.ts'

const row = (path: string, title: string, artist: string, extension: string, downloads: string) => `
					<tr>
				<td class="ucwords"><a href="https://guitarprotabs.org${path}" title="${title} by${artist}"><span Class='highlight'>x</span></a></td>
				<td><a href="https://guitarprotabs.org/m/metallica/1/" title="${artist} Guitar Pro Tabs">${artist}</a></td>
				<td>${extension}</td>
				<td><span class="badge">${downloads}</span></td>
			</tr>`

const searchPage = `<table class="table table-striped"><tbody>
  ${row('/m/metallica/nothing_else_matters_11731/', 'Nothing Else Matters', 'Metallica', '.gp3', '172,780')}
  ${row('/m/metallica/nothing_else_matters___s&amp;m_11729/', 'Nothing Else Matters   S&amp;M', 'Metallica', '.gp4', '1,200')}
  ${row('/m/metallica/nothing_else_matters_(2)_11719/', 'Nothing Else Matters (2)', 'Metallica', '.gp3', '900')}
</tbody></table>`

describe('guitarprotabs.org', () => {
  it('reads song, artist, file type and downloads from each row', () => {
    expect(parseGuitarprotabsSearch(searchPage)[1]).toEqual({
      artist: 'Metallica',
      title: 'Nothing Else Matters S&M',
      path: '/m/metallica/nothing_else_matters___s&m_11729/',
      extension: 'gp4',
      downloads: 1200,
    })
  })

  it('lists the matching songs, versions told apart', async () => {
    const results = await searchGuitarprotabs({ artist: 'Metallica', title: 'Nothing Else Matters' }, () =>
      Promise.resolve(searchPage),
    )

    expect(results.map((tab) => [tab.title, tab.kind])).toEqual([
      ['Nothing Else Matters', 'Guitar Pro (.gp3)'],
      ['Nothing Else Matters', 'Guitar Pro (.gp3) · version 2'],
      ['Nothing Else Matters S&M', 'Guitar Pro (.gp4)'],
    ])
    expect(results[0]).toMatchObject({
      id: 'guitarprotabs:/m/metallica/nothing_else_matters_11731/',
      downloadPath: '/m/metallica/nothing_else_matters_11731/',
    })
  })

  it('opens the song page first, then downloads with its cookies and as its referrer', async () => {
    const fetchImpl = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/download/')
          ? new Response(new Uint8Array([1, 2]), {
              headers: { 'Content-Disposition': 'attachment; filename="Metallica - Nothing Else Matters.gp3"' },
            })
          : new Response('<html></html>', {
              headers: [
                ['Content-Type', 'text/html'],
                ['Set-Cookie', 'PHPSESSID=abc; path=/'],
                ['Set-Cookie', 'visited=1; path=/'],
              ],
            }),
      ),
    )

    const file = await guitarprotabsFiles.fetchFile(
      '/m/metallica/nothing_else_matters_11731/',
      fetchImpl as unknown as typeof fetch,
    )

    const [, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit]
    expect(fetchImpl.mock.calls[1]![0]).toBe('https://guitarprotabs.org/m/metallica/nothing_else_matters_11731/download/')
    expect(init.headers).toMatchObject({
      Cookie: 'PHPSESSID=abc; visited=1',
      Referer: 'https://guitarprotabs.org/m/metallica/nothing_else_matters_11731/',
    })
    expect(file.fileName).toBe('Metallica - Nothing Else Matters.gp3')
  })

  it('refuses the song page when it comes back instead of the file', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })))

    await expect(
      guitarprotabsFiles.fetchFile('/m/metallica/one_1/', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('guitarprotabs.org did not hand over the file')
  })
})
