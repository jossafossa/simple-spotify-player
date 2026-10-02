import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useTabWorkspace } from './useTabWorkspace'

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
    await waitFor(() => expect(result.current.tabCounts).toEqual({ [song.uri]: 1 }))

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
})
