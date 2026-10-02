import { expect, it } from 'vitest'
import { searchSongsterr } from './songsterr.ts'

it('links matching Songsterr songs, naming their instruments', async () => {
  const songs = [
    {
      songId: 14563,
      artist: 'Nightwish',
      title: 'Nemo',
      tracks: [{ instrument: 'Distortion Guitar' }, { instrument: 'Distortion Guitar' }, { instrument: 'Electric Bass' }],
    },
    { songId: 9, artist: 'Nightwish', title: 'Amaranth', tracks: [] },
  ]
  let requested = ''

  const results = await searchSongsterr({ artist: 'Nightwish', title: 'Nemo' }, (url) => {
    requested = url
    return Promise.resolve(JSON.stringify(songs))
  })

  expect(requested).toBe('https://www.songsterr.com/api/songs?pattern=Nightwish%20Nemo&size=10')
  expect(results).toEqual([
    expect.objectContaining({
      id: 'songsterr:14563',
      kind: 'Songsterr · Distortion Guitar, Electric Bass',
      url: 'https://www.songsterr.com/a/wsa/nightwish-nemo-tab-s14563',
      downloadPath: undefined,
      relevance: 1,
    }),
  ])
})
