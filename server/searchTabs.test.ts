import { expect, it } from 'vitest'
import { searchTabs } from './searchTabs.ts'

it('merges every source, best match first, and reports sources that failed', async () => {
  const response = await searchTabs({ artist: 'Nightwish', title: 'Nemo' }, (url) => {
    if (url.includes('songsterr')) {
      return Promise.reject(new Error('Songsterr is down'))
    }
    if (url.includes('ultimate-guitar')) {
      return Promise.resolve('<html></html>')
    }
    return Promise.resolve(
      url.includes('/search')
        ? ''
        : '<a href="/en/tabs/nightwish/nemo-cover">Nemo cover</a><a href="/en/tabs/nightwish/nemo">Nemo</a>',
    )
  })

  expect(response.results.map((tab) => tab.title)).toEqual(['Nemo', 'Nemo cover'])
  expect(response.failures).toEqual([{ source: 'songsterr', message: 'Songsterr is down' }])
})
