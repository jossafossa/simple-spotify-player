import { render } from '@testing-library/react'
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

  it('hands the file to alphaTab', () => {
    renderViewer()

    expect(mockedUseAlphaTab).toHaveBeenLastCalledWith(expect.anything(), data)
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

    expect(mockedUseAlphaTab).toHaveBeenLastCalledWith(expect.anything(), undefined)
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
})
