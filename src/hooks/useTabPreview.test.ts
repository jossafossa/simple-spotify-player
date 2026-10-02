import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadOnlineTab, type OnlineTab } from '~/lib/onlineTabSearch'
import { readTabLibrary } from '~/lib/tabDatabase'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useTabLibrary } from './useTabLibrary'
import { useTabPreview } from './useTabPreview'

vi.mock('~/lib/onlineTabSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/onlineTabSearch')>()),
  downloadOnlineTab: vi.fn(),
}))

const mockedDownload = vi.mocked(downloadOnlineTab)
const song = { uri: 'spotify:track:amaranth', name: 'Amaranth', artistNames: ['Nightwish'] }
const online: OnlineTab = {
  id: 'gprotab:/en/tabs/nightwish/amaranth-2',
  source: 'gprotab',
  artist: 'Nightwish',
  title: 'Amaranth',
  kind: 'Guitar Pro · version 2',
  url: 'https://gprotab.net/en/tabs/nightwish/amaranth-2',
  downloadPath: '/en/tabs/nightwish/amaranth-2',
  rating: undefined,
  votes: undefined,
  relevance: 1,
}

const renderPreview = async () => {
  const view = renderHook(() => {
    const library = useTabLibrary()
    return { library, preview: useTabPreview(library) }
  })
  await waitFor(() => expect(view.result.current.library.status).toBe('ready'))
  return view
}

describe('useTabPreview', () => {
  beforeEach(async () => {
    await resetTabDatabase()
    mockedDownload.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows an online tab from memory without storing it', async () => {
    mockedDownload.mockResolvedValue(new File([new Uint8Array([1, 2])], 'nightwish-amaranth_2.gp5'))
    const { result } = await renderPreview()

    act(() => result.current.preview.previewOnlineTab(online, song))
    expect(result.current.preview.preview).toMatchObject({ dataStatus: 'loading', song })

    await waitFor(() => expect(result.current.preview.preview?.dataStatus).toBe('ready'))
    expect(result.current.preview.preview?.tab).toMatchObject({
      name: 'Amaranth · GProTab version 2',
      fileName: 'nightwish-amaranth_2.gp5',
      format: 'guitar-pro',
    })
    expect([...new Uint8Array(result.current.preview.preview!.data!)]).toEqual([1, 2])
    expect(await readTabLibrary()).toEqual({ tabs: [], songs: [] })
  })

  it('adds the previewed file without downloading it again', async () => {
    mockedDownload.mockResolvedValue(new File([new Uint8Array([1])], 'a.gp5'))
    const { result } = await renderPreview()
    act(() => result.current.preview.previewOnlineTab(online, song))
    await waitFor(() => expect(result.current.preview.preview?.dataStatus).toBe('ready'))

    let tabId: string | undefined
    await act(async () => {
      tabId = await result.current.preview.addPreviewed()
    })

    expect(mockedDownload).toHaveBeenCalledOnce()
    expect(result.current.library.tabs).toEqual([expect.objectContaining({ id: tabId, name: 'Amaranth · GProTab version 2' })])
    expect(result.current.library.songs).toEqual([{ ...song, tabIds: [tabId] }])
  })

  it('reports a download that failed', async () => {
    mockedDownload.mockRejectedValue(new Error('gone'))
    const { result } = await renderPreview()

    act(() => result.current.preview.previewOnlineTab(online, song))

    await waitFor(() => expect(result.current.preview.preview?.dataStatus).toBe('error'))
  })

  it('previews a library tab, and adds it by linking', async () => {
    const { result } = await renderPreview()
    let tabId = ''
    await act(async () => {
      tabId = (await result.current.library.addTabFile(new File([new Uint8Array([7])], 'Solo.gp5'))).id
    })

    act(() => result.current.preview.previewLibraryTab(tabId, song))
    await waitFor(() => expect(result.current.preview.preview?.dataStatus).toBe('ready'))
    expect(result.current.library.songs).toEqual([])

    await act(async () => {
      await result.current.preview.addPreviewed()
    })
    expect(result.current.library.songs).toEqual([{ ...song, tabIds: [tabId] }])
  })

  it('closes', async () => {
    mockedDownload.mockResolvedValue(new File([new Uint8Array([1])], 'a.gp5'))
    const { result } = await renderPreview()
    act(() => result.current.preview.previewOnlineTab(online, song))

    act(() => result.current.preview.closePreview())

    expect(result.current.preview.preview).toBeUndefined()
  })
})
