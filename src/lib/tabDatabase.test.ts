import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteSong,
  deleteTab,
  readTabData,
  readTabLibrary,
  resetTabDatabaseConnection,
  writeSong,
  writeTabLibrary,
} from './tabDatabase'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import type { TabFile } from './types'

const buildTab = (id: string): TabFile => ({
  id,
  name: id,
  fileName: `${id}.gp5`,
  format: 'guitar-pro',
  sizeBytes: 2,
  addedAt: 1,
})

describe('tabDatabase', () => {
  beforeEach(resetTabDatabase)

  afterEach(async () => {
    await resetTabDatabaseConnection()
  })

  it('starts empty', async () => {
    expect(await readTabLibrary()).toEqual({ tabs: [], songs: [] })
  })

  it('stores tabs apart from their bytes, and songs', async () => {
    await writeTabLibrary({
      tabs: [{ tab: buildTab('a'), data: new Uint8Array([1, 2]).buffer }],
      songs: [{ uri: 'spotify:track:1', name: 'One', artistNames: [], tabIds: ['a'] }],
    })

    const library = await readTabLibrary()
    expect(library.tabs).toEqual([buildTab('a')])
    expect(library.songs[0]?.tabIds).toEqual(['a'])
    expect([...new Uint8Array((await readTabData('a'))!)]).toEqual([1, 2])
    expect(await readTabData('missing')).toBeUndefined()
  })

  it('replaces and deletes songs by uri', async () => {
    await writeSong({ uri: 'spotify:track:1', name: 'One', artistNames: [], tabIds: ['a'] })
    await writeSong({ uri: 'spotify:track:1', name: 'One', artistNames: [], tabIds: ['a', 'b'] })
    expect((await readTabLibrary()).songs).toHaveLength(1)

    await deleteSong('spotify:track:1')
    expect((await readTabLibrary()).songs).toEqual([])
  })

  it('deleting a tab unlinks it, and drops songs left with none', async () => {
    await writeTabLibrary({
      tabs: [
        { tab: buildTab('a'), data: new ArrayBuffer(1) },
        { tab: buildTab('b'), data: new ArrayBuffer(1) },
      ],
      songs: [
        { uri: 'spotify:track:1', name: 'One', artistNames: [], tabIds: ['a'] },
        { uri: 'spotify:track:2', name: 'Two', artistNames: [], tabIds: ['a', 'b'] },
      ],
    })

    await deleteTab('a')

    const library = await readTabLibrary()
    expect(library.tabs.map((tab) => tab.id)).toEqual(['b'])
    expect(library.songs).toEqual([
      { uri: 'spotify:track:2', name: 'Two', artistNames: [], tabIds: ['b'] },
    ])
    expect(await readTabData('a')).toBeUndefined()
  })
})
