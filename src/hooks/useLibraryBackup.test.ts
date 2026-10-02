import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLibraryBackup } from '~/lib/libraryBackup'
import { readPinnedPlaylists, savePinnedPlaylists } from '~/lib/pinnedPlaylistsStorage'
import { readTabData, readTabLibrary, writeTabLibrary } from '~/lib/tabDatabase'
import type { TabFile } from '~/lib/types'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useLibraryBackup } from './useLibraryBackup'

const tab: TabFile = {
  id: 'tab-1',
  name: 'Nemo',
  fileName: 'Nemo.gp5',
  format: 'guitar-pro',
  sizeBytes: 2,
  addedAt: 1,
}
const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'], tabIds: ['tab-1'] }
const pin = { uri: 'spotify:playlist:mix', name: 'My Mix' }

describe('useLibraryBackup', () => {
  beforeEach(async () => {
    await resetTabDatabase()
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports tabs, songs and pins as one file to save', async () => {
    await writeTabLibrary({ tabs: [{ tab, data: new Uint8Array([4, 2]).buffer }], songs: [song] })
    savePinnedPlaylists([pin])
    let savedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob
      return 'blob:backup'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { result } = renderHook(() => useLibraryBackup(vi.fn()))
    await act(() => result.current.exportLibrary())

    expect(click).toHaveBeenCalledOnce()
    const backup = JSON.parse(await savedBlob!.text())
    expect(backup).toMatchObject({ app: 'simple-spotify-player', songs: [song], pinnedPlaylists: [pin] })
    expect(backup.tabs[0]).toMatchObject({ id: 'tab-1', dataBase64: 'BAI=' })
    expect(result.current.status).toEqual({ kind: 'done', message: 'Exported 1 tab and 1 song.' })
  })

  it('imports a backup on top of what is there and tells the library to reload', async () => {
    await writeTabLibrary({
      tabs: [{ tab: { ...tab, id: 'tab-0' }, data: new ArrayBuffer(1) }],
      songs: [{ ...song, tabIds: ['tab-0'] }],
    })
    const other = { uri: 'spotify:playlist:other', name: 'Other' }
    savePinnedPlaylists([other])
    const backup = buildLibraryBackup({
      tabs: [{ tab, data: new Uint8Array([7]).buffer }],
      songs: [song],
      pinnedPlaylists: [pin],
    })
    const onImported = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useLibraryBackup(onImported))
    await act(() => result.current.importLibrary(new File([JSON.stringify(backup)], 'backup.json')))

    const library = await readTabLibrary()
    expect(library.tabs.map((entry) => entry.id).sort()).toEqual(['tab-0', 'tab-1'])
    expect(library.songs).toEqual([{ ...song, tabIds: ['tab-0', 'tab-1'] }])
    expect([...new Uint8Array((await readTabData('tab-1'))!)]).toEqual([7])
    expect(readPinnedPlaylists()).toEqual([other, pin])
    expect(onImported).toHaveBeenCalledOnce()
    expect(result.current.status).toEqual({ kind: 'done', message: 'Imported 1 tab and 1 song.' })
  })

  it('reports a file that is not a backup, and changes nothing', async () => {
    const onImported = vi.fn()
    const { result } = renderHook(() => useLibraryBackup(onImported))

    await act(() => result.current.importLibrary(new File(['{"hello":1}'], 'other.json')))

    expect(result.current.status).toEqual({
      kind: 'error',
      message: 'This is not a backup this app can read: it was not exported from this app',
    })
    expect(onImported).not.toHaveBeenCalled()
    expect(await readTabLibrary()).toEqual({ tabs: [], songs: [] })
  })
})
