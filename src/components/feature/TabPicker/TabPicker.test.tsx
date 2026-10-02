import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TabFile } from '~/lib/types'
import { TabPicker } from './TabPicker'

const buildTab = (id: string, name: string, format: TabFile['format'] = 'guitar-pro'): TabFile => ({
  id,
  name,
  fileName: `${name}.gp5`,
  format,
  sizeBytes: 2048,
  addedAt: 1,
})

const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'] }
const nemo = buildTab('nemo', 'Nemo solo')
const amaranth = buildTab('amaranth', 'Amaranth')
const tuxed = buildTab('ptb', 'Old Power Tab', 'power-tab')

const renderPicker = (props: Partial<React.ComponentProps<typeof TabPicker>> = {}) => {
  const handlers = {
    onLink: vi.fn(),
    onUnlink: vi.fn(),
    onUpload: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
  }
  const view = render(
    <TabPicker
      song={song}
      tabs={[nemo, amaranth, tuxed]}
      linkedTabIds={['nemo']}
      uploadError={undefined}
      {...handlers}
      {...props}
    />,
  )
  return { ...view, ...handlers }
}

describe('TabPicker', () => {
  it('names the song and lists its tabs apart from the rest of the library', () => {
    const { getByRole } = renderPicker()

    expect(getByRole('dialog', { name: 'Tabs for this song' })).toHaveTextContent('Nemo — Nightwish')
    expect(getByRole('region', { name: 'On this song' })).toHaveTextContent('Nemo solo')
    expect(getByRole('region', { name: 'Library' })).not.toHaveTextContent('Nemo solo')
    expect(getByRole('region', { name: 'Library' })).toHaveTextContent('Power Tab · 2 KB')
  })

  it('searches the library and adds the picked tab', async () => {
    const user = userEvent.setup()
    const { getByRole, queryByRole, onLink } = renderPicker()

    await user.type(getByRole('searchbox', { name: 'Search your tabs' }), 'amar')

    expect(queryByRole('button', { name: 'Add Old Power Tab' })).not.toBeInTheDocument()
    await user.click(getByRole('button', { name: 'Add Amaranth' }))
    expect(onLink).toHaveBeenCalledWith('amaranth')
  })

  it('says when nothing matches', async () => {
    const user = userEvent.setup()
    const { getByRole, getByText } = renderPicker()

    await user.type(getByRole('searchbox', { name: 'Search your tabs' }), 'zzz')

    expect(getByText('No tabs match “zzz”.')).toBeInTheDocument()
  })

  it('opens and removes tabs on the song', async () => {
    const user = userEvent.setup()
    const { getByRole, onOpen, onUnlink } = renderPicker()

    await user.click(getByRole('button', { name: /^Nemo solo/ }))
    await user.click(getByRole('button', { name: 'Remove Nemo solo from this song' }))

    expect(onOpen).toHaveBeenCalledWith('nemo')
    expect(onUnlink).toHaveBeenCalledWith('nemo')
  })

  it('uploads a new file and shows why one was refused', async () => {
    const user = userEvent.setup()
    const { getByLabelText, getByRole, onUpload } = renderPicker({ uploadError: 'Not a tab.' })
    const file = new File(['x'], 'new.gp5')

    await user.upload(getByLabelText('Upload a new tab'), file)

    expect(onUpload).toHaveBeenCalledWith(file)
    expect(getByRole('alert')).toHaveTextContent('Not a tab.')
  })

  it('guides an empty library to an upload', () => {
    const { getByText } = renderPicker({ tabs: [], linkedTabIds: [] })

    expect(getByText(/Your library is empty/)).toBeInTheDocument()
  })

  it('places the online search it is given', () => {
    const { getByText } = renderPicker({ onlineSearch: <p>Online search here</p> })

    expect(getByText('Online search here')).toBeInTheDocument()
  })
})
