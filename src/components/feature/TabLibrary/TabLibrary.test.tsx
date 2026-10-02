import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TabFile, TabSong } from '~/lib/types'
import { TabLibrary } from './TabLibrary'

const buildTab = (id: string, name: string): TabFile => ({
  id,
  name,
  fileName: `${name}.gp5`,
  format: 'guitar-pro',
  sizeBytes: 1024,
  addedAt: 1,
})

const nemoTab = buildTab('nemo', 'Nemo solo')
const loose = buildTab('loose', 'Loose riff')
const nemo: TabSong = {
  uri: 'spotify:track:nemo',
  name: 'Nemo',
  artistNames: ['Nightwish'],
  tabIds: ['nemo'],
}

const renderLibrary = (props: Partial<React.ComponentProps<typeof TabLibrary>> = {}) => {
  const handlers = {
    onOpenTab: vi.fn(),
    onPlaySong: vi.fn(),
    onManageSong: vi.fn(),
    onDeleteTab: vi.fn(),
    onUpload: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onClose: vi.fn(),
  }
  const view = render(
    <TabLibrary
      songs={[nemo]}
      tabs={[nemoTab, loose]}
      backupStatus={{ kind: 'idle' }}
      uploadError={undefined}
      {...handlers}
      {...props}
    />,
  )
  return { ...view, ...handlers }
}

describe('TabLibrary', () => {
  it('counts what is stored', () => {
    const { getByRole } = renderLibrary()

    expect(getByRole('dialog')).toHaveTextContent('1 song · 2 tabs · stored in this browser')
  })

  it('lists songs with their tabs, to open, play or manage', async () => {
    const user = userEvent.setup()
    const { getByRole, onOpenTab, onPlaySong, onManageSong } = renderLibrary()
    const songs = getByRole('region', { name: 'Songs' })

    expect(songs).toHaveTextContent('Nightwish')
    await user.click(getByRole('button', { name: 'Nemo solo' }))
    await user.click(getByRole('button', { name: 'Play Nemo' }))
    await user.click(getByRole('button', { name: 'Manage tabs for Nemo' }))

    expect(onOpenTab).toHaveBeenCalledWith(nemo, 'nemo')
    expect(onPlaySong).toHaveBeenCalledWith(nemo)
    expect(onManageSong).toHaveBeenCalledWith(nemo)
  })

  it('lists every file with how many songs use it', async () => {
    const user = userEvent.setup()
    const { getByRole, onOpenTab, onDeleteTab } = renderLibrary()
    const files = getByRole('region', { name: 'Files' })

    expect(files).toHaveTextContent('on 1 song')
    expect(files).toHaveTextContent('not on a song')
    await user.click(getByRole('button', { name: /^Loose riff/ }))
    await user.click(getByRole('button', { name: 'Delete Loose riff' }))

    expect(onOpenTab).toHaveBeenCalledWith(undefined, 'loose')
    expect(onDeleteTab).toHaveBeenCalledWith(loose)
  })

  it('searches songs by artist and by tab name, and files by name', async () => {
    const user = userEvent.setup()
    const { getByRole } = renderLibrary()
    const search = getByRole('searchbox', { name: 'Search the library' })

    await user.type(search, 'nightwish')
    expect(getByRole('region', { name: 'Songs' })).toHaveTextContent('Nemo')
    expect(getByRole('region', { name: 'Files' })).toHaveTextContent('No files match.')

    await user.clear(search)
    await user.type(search, 'loose')
    expect(getByRole('region', { name: 'Songs' })).toHaveTextContent('No songs match.')
    expect(getByRole('region', { name: 'Files' })).toHaveTextContent('Loose riff')
  })

  it('exports and imports, and reports the outcome', async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText, onExport, onImport, rerender } = renderLibrary()
    const backup = new File(['{}'], 'backup.json')

    await user.click(getByRole('button', { name: 'Export library' }))
    await user.upload(getByLabelText('Import library'), backup)
    expect(onExport).toHaveBeenCalledOnce()
    expect(onImport).toHaveBeenCalledWith(backup)

    rerender(
      <TabLibrary
        songs={[nemo]}
        tabs={[nemoTab]}
        backupStatus={{ kind: 'error', message: 'Not a backup.' }}
        uploadError={undefined}
        onOpenTab={vi.fn()}
        onPlaySong={vi.fn()}
        onManageSong={vi.fn()}
        onDeleteTab={vi.fn()}
        onUpload={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(getByRole('alert')).toHaveTextContent('Not a backup.')
  })

  it('disables the backup buttons while one is running', () => {
    const { getByRole } = renderLibrary({ backupStatus: { kind: 'working' } })

    expect(getByRole('button', { name: 'Export library' })).toBeDisabled()
    expect(getByRole('button', { name: 'Import library' })).toBeDisabled()
  })

  it('explains how to start when empty', () => {
    const { getByText } = renderLibrary({ songs: [], tabs: [] })

    expect(getByText(/Use the TAB button next to a track/)).toBeInTheDocument()
  })
})
