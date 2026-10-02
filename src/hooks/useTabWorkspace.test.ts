import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadOnlineTab, searchOnlineTabs, type OnlineTab } from '~/lib/onlineTabSearch'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useTabWorkspace } from './useTabWorkspace'

vi.mock('~/lib/onlineTabSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/onlineTabSearch')>()),
  searchOnlineTabs: vi.fn(() => Promise.resolve({ results: [], failures: [] })),
  downloadOnlineTab: vi.fn(),
}))

const onlineTab: OnlineTab = {
  id: 'gprotab:/en/tabs/nightwish/nemo-2',
  source: 'gprotab',
  artist: 'Nightwish',
  title: 'Nemo',
  kind: 'Guitar Pro · version 2',
  url: 'https://gprotab.net/en/tabs/nightwish/nemo-2',
  downloadPath: '/en/tabs/nightwish/nemo-2',
  rating: undefined,
  votes: undefined,
  relevance: 1,
}

const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }
const gpFile = (name = 'Nemo.gp5') => new File([new Uint8Array([1])], name)

const renderWorkspace = async () => {
  const view = renderHook(() => useTabWorkspace())
  await waitFor(() => expect(view.result.current.library.status).toBe('ready'))
  return view
}

describe('useTabWorkspace', () => {
  beforeEach(async () => {
    await resetTabDatabase()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the picker for a song without tabs', async () => {
    const { result } = await renderWorkspace()

    act(() => result.current.openSongTabs(song))

    expect(result.current.pickerSong).toEqual(song)
    expect(result.current.openTab).toBeUndefined()
  })

  it('opens the first tab of a song that has one, and counts it', async () => {
    const { result } = await renderWorkspace()
    act(() => result.current.uploadTab(gpFile(), song))
    await waitFor(() => expect(result.current.tabCountFor(song)).toBe(1))

    act(() => result.current.openSongTabs(song))

    expect(result.current.pickerSong).toBeUndefined()
    expect(result.current.openTab?.tab.name).toBe('Nemo')
    expect(result.current.openTab?.songTabs.map((tab) => tab.name)).toEqual(['Nemo'])
    await waitFor(() => expect(result.current.openTab?.data.status).toBe('ready'))
  })

  it('reports an upload it refused', async () => {
    const { result } = await renderWorkspace()

    act(() => result.current.uploadTab(gpFile('notes.txt'), song))

    await waitFor(() => expect(result.current.uploadError).toMatch(/notes\.txt/))
  })

  it('only one dialog is open at a time', async () => {
    const { result } = await renderWorkspace()

    act(() => result.current.openPicker(song))
    act(() => result.current.openLibrary())
    expect(result.current.pickerSong).toBeUndefined()
    expect(result.current.isLibraryOpen).toBe(true)

    act(() => result.current.openPicker(song))
    expect(result.current.isLibraryOpen).toBe(false)
  })

  it('deletes a tab after confirming, closing it if it was open', async () => {
    const { result } = await renderWorkspace()
    act(() => result.current.uploadTab(gpFile(), song))
    await waitFor(() => expect(result.current.library.tabs).toHaveLength(1))
    const tab = result.current.library.tabs[0]!
    act(() => result.current.openTabInViewer(song, tab.id))

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    act(() => result.current.deleteTab(tab))
    expect(result.current.library.tabs).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    act(() => result.current.deleteTab(tab))

    expect(result.current.openTab).toBeUndefined()
    await waitFor(() => expect(result.current.library.tabs).toEqual([]))
  })

  it('waits for the button before searching online, starting from a clean slate', async () => {
    const { result } = await renderWorkspace()
    act(() => result.current.online.search({ artist: 'Old', title: 'Search' }))

    act(() => result.current.openPicker({ ...song, name: 'Nemo - Remastered 2021' }))

    expect(result.current.online.state).toEqual({ kind: 'idle' })
    vi.mocked(searchOnlineTabs).mockClear()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(searchOnlineTabs).not.toHaveBeenCalled()
  })

  it('downloads a found tab into the library, linked to the picker’s song', async () => {
    vi.mocked(downloadOnlineTab).mockResolvedValue(new File([new Uint8Array([1])], 'nightwish-nemo_2.gp4'))
    const { result } = await renderWorkspace()
    act(() => result.current.openPicker(song))

    act(() => result.current.online.addOnlineTab(onlineTab))
    expect(result.current.online.addingIds).toEqual([onlineTab.id])

    await waitFor(() => expect(result.current.online.addedIds).toEqual([onlineTab.id]))
    expect(result.current.online.addingIds).toEqual([])
    expect(result.current.library.tabs[0]).toMatchObject({
      name: 'Nemo · GProTab version 2',
      fileName: 'nightwish-nemo_2.gp4',
    })
    expect(result.current.tabCountFor(song)).toBe(1)
  })

  it('reports a found tab it could not download', async () => {
    vi.mocked(downloadOnlineTab).mockRejectedValue(new Error('Could not download “Nemo”.'))
    const { result } = await renderWorkspace()
    act(() => result.current.openPicker(song))

    act(() => result.current.online.addOnlineTab(onlineTab))

    await waitFor(() => expect(result.current.uploadError).toBe('Could not download “Nemo”.'))
    expect(result.current.online.addingIds).toEqual([])
    expect(result.current.library.tabs).toEqual([])
  })

  it('finds a song’s tabs under a relinked URI or a remaster, and keeps adding to the same entry', async () => {
    const { result } = await renderWorkspace()
    act(() => result.current.uploadTab(gpFile(), song))
    await waitFor(() => expect(result.current.tabCountFor(song)).toBe(1))

    const relinked = { ...song, uri: 'spotify:track:relinked', alternateUris: [song.uri] }
    const remaster = { ...song, uri: 'spotify:track:remaster', name: 'Nemo - Remastered 2021' }
    expect(result.current.tabCountFor(relinked)).toBe(1)
    expect(result.current.tabCountFor(remaster)).toBe(1)
    expect(result.current.tabCountFor({ ...song, uri: 'spotify:track:x', name: 'Amaranth' })).toBe(0)

    act(() => result.current.openPicker(remaster))
    expect(result.current.pickerSong?.uri).toBe(song.uri)
    act(() => result.current.uploadTab(gpFile('Second.gp5'), result.current.pickerSong))

    await waitFor(() => expect(result.current.tabCountFor(song)).toBe(2))
    expect(result.current.library.songs).toHaveLength(1)
  })

  it('previews a found tab for the picker’s song, then adds it and shows it as linked', async () => {
    vi.mocked(downloadOnlineTab).mockResolvedValue(new File([new Uint8Array([1])], 'nightwish-nemo_2.gp4'))
    const { result } = await renderWorkspace()
    act(() => result.current.openPicker(song))

    act(() => result.current.previewOnlineTab(onlineTab))
    await waitFor(() => expect(result.current.preview?.dataStatus).toBe('ready'))
    expect(result.current.pickerSong).toEqual(song)
    expect(result.current.library.tabs).toEqual([])

    act(() => result.current.addPreviewed())

    await waitFor(() => expect(result.current.openTab?.tab.name).toBe('Nemo · GProTab version 2'))
    expect(result.current.preview).toBeUndefined()
    expect(result.current.pickerSong).toBeUndefined()
    expect(result.current.tabCountFor(song)).toBe(1)
  })

  it('goes back from a preview to the picker', async () => {
    vi.mocked(downloadOnlineTab).mockResolvedValue(new File([new Uint8Array([1])], 'a.gp4'))
    const { result } = await renderWorkspace()
    act(() => result.current.openPicker(song))
    act(() => result.current.previewOnlineTab(onlineTab))

    act(() => result.current.closePreview())

    expect(result.current.preview).toBeUndefined()
    expect(result.current.pickerSong).toEqual(song)
  })
})
