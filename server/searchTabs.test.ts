import { expect, it, vi } from 'vitest'
import { searchTabs } from './searchTabs.ts'

it('merges every source, best match first, and reports sources that failed', async () => {
  const response = await searchTabs({ artist: 'Nightwish', title: 'Nemo' }, (url) => {
    if (url.includes('songsterr')) {
      return Promise.reject(new Error('Songsterr is down'))
    }
    if (url.includes('ultimate-guitar') || url.includes('gtptabs') || url.includes('guitarprotabs.org')) {
      return Promise.resolve('<html></html>')
    }
    if (url.includes('theguitarlesson')) {
      return Promise.resolve('[]')
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

it('leaves out copies of a file listed higher up, and gives the others size and fingerprint', async () => {
  const fetchPage = (url: string) => {
    if (url.includes('theguitarlesson')) {
      return Promise.resolve('[]')
    }
    if (url.includes('gprotab.net/en/tabs/nightwish')) {
      return Promise.resolve(
        '<a href="/en/tabs/nightwish/nemo">Nemo</a><a href="/en/tabs/nightwish/nemo-2">Nemo 2</a><a href="/en/tabs/nightwish/nemo-3">Nemo 3</a>',
      )
    }
    return Promise.resolve(url.includes('songsterr') ? '[]' : '')
  }
  const files: Record<string, number[]> = {
    '/en/tabs/nightwish/nemo': [1, 2, 3],
    '/en/tabs/nightwish/nemo-2': [1, 2, 3],
  }
  const fetchFile = vi.fn((_source: string, path: string) =>
    files[path]
      ? Promise.resolve({ data: new Uint8Array(files[path]), fileName: 'x.gp5' })
      : Promise.reject(new Error('gone')),
  )

  const response = await searchTabs({ artist: 'Nightwish', title: 'Nemo' }, fetchPage, fetchFile)

  expect(response.results.map((tab) => tab.id)).toEqual([
    'gprotab:/en/tabs/nightwish/nemo',
    'gprotab:/en/tabs/nightwish/nemo-3',
  ])
  expect(response.results[0]).toMatchObject({ sizeBytes: 3, fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) })
  expect(response.results[1]!.fingerprint).toBeUndefined()
})

it('compares every file, a few at a time, and gives up on one that is too slow', async () => {
  const versions = Array.from({ length: 13 }, (_, index) => `<a href="/en/tabs/nightwish/nemo-${index + 2}">Nemo ${index + 2}</a>`)
  const fetchPage = (url: string) => {
    if (url.includes('theguitarlesson') || url.includes('songsterr')) {
      return Promise.resolve('[]')
    }
    return Promise.resolve(url.includes('gprotab.net/en/tabs/nightwish') ? versions.join('') : '')
  }
  let running = 0
  let mostAtOnce = 0
  const fetchFile = vi.fn(async (_source: string, path: string) => {
    running++
    mostAtOnce = Math.max(mostAtOnce, running)
    await new Promise((resolve) => setTimeout(resolve, path.endsWith('nemo-14') ? 200 : 1))
    running--
    // Versions 2 and 13 are the same file.
    const size = path.endsWith('nemo-13') ? 2 : Number(/\d+$/.exec(path)![0])
    return { data: new Uint8Array(size), fileName: 'x.gp5' }
  })

  const response = await searchTabs({ artist: 'Nightwish', title: 'Nemo' }, fetchPage, fetchFile, {
    compareTimeoutMs: 50,
  })

  expect(fetchFile).toHaveBeenCalledTimes(13)
  expect(mostAtOnce).toBeLessThanOrEqual(6)
  const ids = response.results.map((tab) => tab.id)
  expect(ids).not.toContain('gprotab:/en/tabs/nightwish/nemo-13')
  expect(response.results.find((tab) => tab.id.endsWith('nemo-14'))!.fingerprint).toBeUndefined()
})
