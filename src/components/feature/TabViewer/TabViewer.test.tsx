import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAlphaTab, type UseAlphaTabResult } from '~/hooks/useAlphaTab'
import type { TabFile } from '~/lib/types'
import { TabViewer } from './TabViewer'

vi.mock('~/hooks/useAlphaTab', () => ({ useAlphaTab: vi.fn() }))

const mockedUseAlphaTab = vi.mocked(useAlphaTab)

const alphaTabResult = (overrides: Partial<UseAlphaTabResult> = {}): UseAlphaTabResult => ({
  status: 'ready',
  title: 'Nemo (score title)',
  tracks: [
    { index: 0, name: 'Guitar' },
    { index: 1, name: 'Bass' },
  ],
  selectedTrackIndex: 0,
  selectTrack: vi.fn(),
  isPlayerReady: true,
  isPlaying: false,
  playPause: vi.fn(),
  stop: vi.fn(),
  seekTo: vi.fn(),
  ...overrides,
})

const buildTab = (id: string, format: TabFile['format'] = 'guitar-pro'): TabFile => ({
  id,
  name: `Tab ${id}`,
  fileName: format === 'power-tab' ? `${id}.ptb` : `${id}.gp5`,
  format,
  sizeBytes: 1,
  addedAt: 1,
})

const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }
const data = new Uint8Array([1]).buffer

const renderViewer = (props: Partial<React.ComponentProps<typeof TabViewer>> = {}) => {
  const handlers = { onSelectTab: vi.fn(), onManage: vi.fn(), onClose: vi.fn() }
  const view = render(
    <TabViewer
      tab={buildTab('a')}
      data={data}
      dataStatus="ready"
      song={song}
      songTabs={[buildTab('a')]}
      {...handlers}
      {...props}
    />,
  )
  return { ...view, ...handlers }
}

describe('TabViewer', () => {
  beforeEach(() => {
    localStorage.clear()
    mockedUseAlphaTab.mockReturnValue(alphaTabResult())
  })

  it('shows the score title for the song it was opened for', () => {
    const { getByRole } = renderViewer()

    const viewer = getByRole('region', { name: 'Tab viewer' })
    expect(viewer).toHaveTextContent('Nemo — Nightwish')
    expect(getByRole('heading', { name: 'Nemo (score title)' })).toBeInTheDocument()
  })

  it('covers the page, stopping it scrolling until it is left', () => {
    const { unmount } = renderViewer()

    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('goes back to the player from the button or on Escape', async () => {
    const user = userEvent.setup()
    const { getByRole, onClose } = renderViewer()

    await user.click(getByRole('button', { name: '← Back to player' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('leaves Escape to a dialog opened on top of it', async () => {
    const user = userEvent.setup()
    const { onClose } = renderViewer()
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.append(dialog)

    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    dialog.remove()
  })

  it('puts Spotify’s transport in the bottom bar when given one', () => {
    const { getByRole } = renderViewer({ playbackControls: <button type="button">Spotify play</button> })

    expect(getByRole('group', { name: 'Spotify playback' })).toContainElement(
      getByRole('button', { name: 'Spotify play' }),
    )
  })

  it('starts on the remembered track and remembers the one picked', () => {
    localStorage.setItem('spotify-player:tab-settings', JSON.stringify({ a: { trackIndex: 1 } }))
    renderViewer()

    const options = mockedUseAlphaTab.mock.lastCall![2]!
    expect(options.initialTrackIndex).toBe(1)

    options.onTrackSelect!(2)
    expect(JSON.parse(localStorage.getItem('spotify-player:tab-settings')!)).toEqual({ a: { trackIndex: 2 } })
  })

  it('hands the file to alphaTab', () => {
    renderViewer()

    expect(mockedUseAlphaTab).toHaveBeenLastCalledWith(expect.anything(), data, expect.anything())
  })

  it('plays, stops and switches track', async () => {
    const user = userEvent.setup()
    const result = alphaTabResult()
    mockedUseAlphaTab.mockReturnValue(result)
    const { getByRole } = renderViewer()

    await user.click(getByRole('button', { name: 'Play tab' }))
    await user.click(getByRole('button', { name: 'Stop' }))
    await user.selectOptions(getByRole('combobox', { name: 'Track' }), 'Bass')

    expect(result.playPause).toHaveBeenCalledOnce()
    expect(result.stop).toHaveBeenCalledOnce()
    expect(result.selectTrack).toHaveBeenCalledWith(1)
  })

  it('waits for the sound font before it can play', () => {
    mockedUseAlphaTab.mockReturnValue(alphaTabResult({ isPlayerReady: false }))
    const { getByRole } = renderViewer()

    expect(getByRole('button', { name: 'Play tab' })).toBeDisabled()
  })

  it('switches between the song’s tabs, and manages or closes them', async () => {
    const user = userEvent.setup()
    const { getByRole, onSelectTab, onManage, onClose } = renderViewer({
      songTabs: [buildTab('a'), buildTab('b')],
    })

    await user.selectOptions(getByRole('combobox', { name: 'Tab' }), 'Tab b')
    await user.click(getByRole('button', { name: 'Manage tabs' }))
    await user.click(getByRole('button', { name: '← Back to player' }))

    expect(onSelectTab).toHaveBeenCalledWith('b')
    expect(onManage).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('explains a file alphaTab could not read', () => {
    mockedUseAlphaTab.mockReturnValue(alphaTabResult({ status: 'error', tracks: [] }))
    const { getByText } = renderViewer()

    expect(getByText(/could not be read as a Guitar Pro tab/)).toBeInTheDocument()
  })

  it('keeps Power Tab files out of alphaTab and offers them for conversion', async () => {
    mockedUseAlphaTab.mockReturnValue(alphaTabResult({ status: 'idle', tracks: [], title: undefined }))
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ptb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { getByRole, getByText, queryByRole } = renderViewer({ tab: buildTab('p', 'power-tab') })

    expect(mockedUseAlphaTab).toHaveBeenLastCalledWith(expect.anything(), undefined, expect.anything())
    expect(getByText(/open it in TuxGuitar and save it as \.gp5/)).toBeInTheDocument()
    expect(queryByRole('button', { name: 'Play tab' })).not.toBeInTheDocument()

    await user.click(getByRole('button', { name: 'Download .ptb' }))
    expect(click).toHaveBeenCalledOnce()
    vi.restoreAllMocks()
  })

  it('says when the file is gone from the library', () => {
    const { getByText } = renderViewer({ data: undefined, dataStatus: 'missing' })

    expect(getByText(/could not be read from the library/)).toBeInTheDocument()
  })

  describe('sync with Spotify', () => {
    const spotifyPlayback = { track: song, positionMs: 12_000, isPaused: false }

    it('is only offered when Spotify is playing', () => {
      const { queryByRole } = renderViewer()

      expect(queryByRole('checkbox', { name: 'Sync with Spotify' })).not.toBeInTheDocument()
    })

    it('follows Spotify instead of playing the tab itself', async () => {
      const user = userEvent.setup()
      const result = alphaTabResult()
      mockedUseAlphaTab.mockReturnValue(result)
      const { getByRole } = renderViewer({ spotifyPlayback })

      await user.click(getByRole('checkbox', { name: 'Sync with Spotify' }))

      expect(result.stop).toHaveBeenCalledOnce()
      expect(result.seekTo).toHaveBeenLastCalledWith(12_000)
      expect(getByRole('button', { name: 'Play tab' })).toBeDisabled()
      expect(getByRole('group', { name: 'Sync with Spotify' })).toHaveTextContent(
        'Click the note you hear to line up',
      )
    })

    it('aligns to a clicked beat', async () => {
      const user = userEvent.setup()
      const result = alphaTabResult()
      mockedUseAlphaTab.mockReturnValue(result)
      const { getByRole } = renderViewer({ spotifyPlayback })
      await user.click(getByRole('checkbox', { name: 'Sync with Spotify' }))

      const { onBeatClick } = mockedUseAlphaTab.mock.lastCall![2]!
      act(() => onBeatClick!(15_000))

      expect(getByRole('button', { name: 'Offset +3.0 s, click to reset' })).toBeInTheDocument()
    })

    it('nudges and resets the offset', async () => {
      const user = userEvent.setup()
      const result = alphaTabResult()
      mockedUseAlphaTab.mockReturnValue(result)
      const { getByRole } = renderViewer({ spotifyPlayback })
      await user.click(getByRole('checkbox', { name: 'Sync with Spotify' }))

      await user.click(getByRole('button', { name: 'Move the tab half a second later' }))
      await user.click(getByRole('button', { name: 'Move the tab half a second later' }))
      expect(getByRole('button', { name: 'Offset +1.0 s, click to reset' })).toBeInTheDocument()
      expect(result.seekTo).toHaveBeenLastCalledWith(13_000)

      await user.click(getByRole('button', { name: 'Move the tab half a second earlier' }))
      await user.click(getByRole('button', { name: /^Offset/ }))
      expect(getByRole('button', { name: 'Offset ±0.0 s, click to reset' })).toBeInTheDocument()
    })

    it('does not warn for a relinked copy or a remaster of the same song', async () => {
      const user = userEvent.setup()
      const { getByRole, queryByText } = renderViewer({
        spotifyPlayback: {
          ...spotifyPlayback,
          track: { uri: 'spotify:track:remaster', name: 'Nemo - Remastered 2021', artistNames: ['Nightwish'] },
        },
      })

      await user.click(getByRole('checkbox', { name: 'Sync with Spotify' }))

      expect(queryByText('Spotify is playing another song')).not.toBeInTheDocument()
    })

    it('warns when Spotify plays another song than the tab’s', async () => {
      const user = userEvent.setup()
      const { getByRole, getByText } = renderViewer({
        spotifyPlayback: {
          ...spotifyPlayback,
          track: { uri: 'spotify:track:other', name: 'Amaranth', artistNames: ['Nightwish'] },
        },
      })

      await user.click(getByRole('checkbox', { name: 'Sync with Spotify' }))

      expect(getByText('Spotify is playing another song')).toBeInTheDocument()
    })
  })

  describe('as a preview', () => {
    it('offers to add the tab, and leads back rather than to the player', async () => {
      const user = userEvent.setup()
      const onAdd = vi.fn()
      const { getByRole, queryByRole, onClose } = renderViewer({ preview: { onAdd, isAdding: false } })

      expect(getByRole('region', { name: 'Tab viewer' })).toHaveTextContent('Preview for Nemo — Nightwish')
      await user.click(getByRole('button', { name: 'Add to this song' }))
      await user.click(getByRole('button', { name: '← Back' }))

      expect(onAdd).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalledOnce()
      expect(queryByRole('button', { name: '← Back to player' })).not.toBeInTheDocument()
    })

    it('cannot add while adding, or before the file is in', () => {
      const adding = renderViewer({ preview: { onAdd: vi.fn(), isAdding: true } })
      expect(adding.getByRole('button', { name: 'Adding…' })).toBeDisabled()
      adding.unmount()

      const loading = renderViewer({ preview: { onAdd: vi.fn(), isAdding: false }, data: undefined, dataStatus: 'loading' })
      expect(loading.getByRole('button', { name: 'Add to this song' })).toBeDisabled()
    })

    it('says when the preview could not be downloaded', () => {
      const { getByText } = renderViewer({
        preview: { onAdd: vi.fn(), isAdding: false },
        data: undefined,
        dataStatus: 'error',
      })

      expect(getByText(/could not be downloaded to preview/)).toBeInTheDocument()
    })
  })
})
