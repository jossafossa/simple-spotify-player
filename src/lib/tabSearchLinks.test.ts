import { expect, it } from 'vitest'
import { buildTabSearchLinks } from './tabSearchLinks'

it('searches by first artist and title, encoded', () => {
  const links = buildTabSearchLinks({
    uri: 'spotify:track:1',
    name: 'Halo & More',
    artistNames: ['Beyoncé', 'Someone'],
  })

  expect(links.map((link) => link.url)).toEqual([
    'https://www.songsterr.com/?pattern=Beyonc%C3%A9%20Halo%20%26%20More',
    'https://www.ultimate-guitar.com/search.php?search_type=title&value=Beyonc%C3%A9%20Halo%20%26%20More',
  ])
})
