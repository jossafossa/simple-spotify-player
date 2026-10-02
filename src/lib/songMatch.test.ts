import { describe, expect, it } from 'vitest'
import { findSameSong, isSameSong } from './songMatch'

const nemo = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }

describe('isSameSong', () => {
  it('matches the same URI, also through an alternate one', () => {
    expect(isSameSong(nemo, { ...nemo, name: 'Whatever' })).toBe(true)
    expect(
      isSameSong(nemo, { uri: 'spotify:track:relinked', name: 'Other', artistNames: [], alternateUris: [nemo.uri] }),
    ).toBe(true)
  })

  it('matches a remaster or another release of the song by title and first artist', () => {
    expect(
      isSameSong(nemo, { uri: 'spotify:track:r', name: 'Nemo - Remastered 2021', artistNames: ['NIGHTWISH', 'Other'] }),
    ).toBe(true)
  })

  it('tells different songs apart', () => {
    expect(isSameSong(nemo, { uri: 'spotify:track:a', name: 'Amaranth', artistNames: ['Nightwish'] })).toBe(false)
    expect(isSameSong(nemo, { uri: 'spotify:track:b', name: 'Nemo', artistNames: ['Someone else'] })).toBe(false)
  })
})

describe('findSameSong', () => {
  it('prefers a URI match over a name match', () => {
    const byName = { ...nemo, uri: 'spotify:track:name-twin' }
    const byUri = { ...nemo, name: 'Renamed', uri: 'spotify:track:relinked' }

    expect(findSameSong({ ...nemo, uri: 'spotify:track:relinked' }, [byName, byUri])).toBe(byUri)
    expect(findSameSong({ ...nemo, uri: 'spotify:track:new' }, [byName, byUri])).toBe(byName)
    expect(findSameSong({ ...nemo, name: 'Amaranth', uri: 'spotify:track:x' }, [byName])).toBeUndefined()
  })
})
