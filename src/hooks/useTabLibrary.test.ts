import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { readTabData, readTabLibrary, writeTabLibrary } from '~/lib/tabDatabase'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { UnsupportedTabFileError, useTabLibrary } from './useTabLibrary'

const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }
const gpFile = (name = 'Nemo.gp5') => new File([new Uint8Array([1, 2, 3])], name)

const renderLibrary = async () => {
  const view = renderHook(() => useTabLibrary())
  await waitFor(() => expect(view.result.current.status).toBe('ready'))
  return view
}

describe('useTabLibrary', () => {
  beforeEach(resetTabDatabase)

  it('opens an empty library', async () => {
    const { result } = await renderLibrary()

    expect(result.current.tabs).toEqual([])
    expect(result.current.songs).toEqual([])
  })

  it('stores an uploaded file and links it to the song it was added for', async () => {
    const { result } = await renderLibrary()

    let added: Awaited<ReturnType<typeof result.current.addTabFile>> | undefined
    await act(async () => {
      added = await result.current.addTabFile(gpFile(), song)
    })

    expect(added).toMatchObject({ name: 'Nemo', fileName: 'Nemo.gp5', format: 'guitar-pro', sizeBytes: 3 })
    expect(result.current.tabs).toEqual([added])
    expect(result.current.songs).toEqual([{ ...song, tabIds: [added!.id] }])
    expect([...new Uint8Array((await readTabData(added!.id))!)]).toEqual([1, 2, 3])
    expect((await readTabLibrary()).songs).toHaveLength(1)
  })

  it('refuses files that are not tabs', async () => {
    const { result } = await renderLibrary()

    await expect(result.current.addTabFile(gpFile('notes.txt'))).rejects.toBeInstanceOf(
      UnsupportedTabFileError,
    )
  })

  it('links and unlinks library tabs, forgetting a song with none left', async () => {
    const { result } = await renderLibrary()
    let tabId = ''
    await act(async () => {
      tabId = (await result.current.addTabFile(gpFile())).id
    })

    await act(() => result.current.linkTab(song, tabId))
    await act(() => result.current.linkTab(song, tabId))
    expect(result.current.songs).toEqual([{ ...song, tabIds: [tabId] }])

    await act(() => result.current.unlinkTab(song.uri, tabId))
    expect(result.current.songs).toEqual([])
    expect((await readTabLibrary()).songs).toEqual([])
  })

  it('removes a tab from the library and from its songs', async () => {
    const { result } = await renderLibrary()
    let tabId = ''
    await act(async () => {
      tabId = (await result.current.addTabFile(gpFile(), song)).id
    })

    await act(() => result.current.removeTab(tabId))

    expect(result.current.tabs).toEqual([])
    expect(result.current.songs).toEqual([])
    expect(await readTabLibrary()).toEqual({ tabs: [], songs: [] })
  })

  it('lists the newest tab first', async () => {
    const stored = (name: string, addedAt: number) => ({
      tab: { id: name, name, fileName: `${name}.gp5`, format: 'guitar-pro' as const, sizeBytes: 1, addedAt },
      data: new ArrayBuffer(1),
    })
    await writeTabLibrary({ tabs: [stored('Old', 1), stored('New', 2)] })

    const { result } = await renderLibrary()

    expect(result.current.tabs.map((tab) => tab.name)).toEqual(['New', 'Old'])
  })
})
