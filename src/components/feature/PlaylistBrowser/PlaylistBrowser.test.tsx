import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistBrowser } from './PlaylistBrowser'

const mix = { uri: 'spotify:playlist:mix', name: 'My Mix' }
const focus = { uri: 'spotify:playlist:focus', name: 'Focus' }

const renderBrowser = (props: Partial<React.ComponentProps<typeof PlaylistBrowser>> = {}) => {
  const handlers = { onSelect: vi.fn(), onTogglePin: vi.fn() }
  const view = render(
    <PlaylistBrowser
      playlists={[mix, focus]}
      isLoading={false}
      pinned={[]}
      selectedUri={undefined}
      {...handlers}
      {...props}
    />,
  )

  return { ...view, ...handlers }
}

describe('PlaylistBrowser', () => {
  it('follows playback until a playlist is picked', () => {
    const { getByRole } = renderBrowser()

    expect(getByRole('combobox', { name: 'Browse' })).toHaveValue('')
    expect(getByRole('button', { name: 'Pin playlist' })).toBeDisabled()
  })

  it('reports the picked playlist, and going back to now playing', async () => {
    const user = userEvent.setup()
    const { getByRole, onSelect } = renderBrowser()
    const select = getByRole('combobox', { name: 'Browse' })

    await user.selectOptions(select, 'Focus')
    expect(onSelect).toHaveBeenLastCalledWith(focus.uri)

    await user.selectOptions(select, 'Now playing')
    expect(onSelect).toHaveBeenLastCalledWith(undefined)
  })

  it('pins and unpins the selected playlist', async () => {
    const user = userEvent.setup()
    const { getByRole, onTogglePin, rerender } = renderBrowser({ selectedUri: mix.uri })

    await user.click(getByRole('button', { name: 'Pin playlist' }))
    expect(onTogglePin).toHaveBeenCalledWith(mix)

    rerender(
      <PlaylistBrowser
        playlists={[mix, focus]}
        isLoading={false}
        pinned={[mix]}
        selectedUri={mix.uri}
        onSelect={vi.fn()}
        onTogglePin={onTogglePin}
      />,
    )
    expect(getByRole('button', { name: 'Unpin playlist' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens a pinned playlist by its name', async () => {
    const user = userEvent.setup()
    const { getByRole, onSelect } = renderBrowser({ pinned: [focus], selectedUri: mix.uri })
    const pins = getByRole('navigation', { name: 'Pinned playlists' })

    await user.click(getByRole('button', { name: 'Focus' }))

    expect(pins).toBeInTheDocument()
    expect(onSelect).toHaveBeenCalledWith(focus.uri)
  })

  it('marks the pin that is open', () => {
    const { getByRole } = renderBrowser({ pinned: [mix, focus], selectedUri: focus.uri })

    expect(getByRole('button', { name: 'Focus' })).toHaveAttribute('aria-current', 'true')
    expect(getByRole('button', { name: 'My Mix' })).not.toHaveAttribute('aria-current')
  })

  it('still offers a pinned playlist the listing has not returned', () => {
    const { getByRole } = renderBrowser({ playlists: [], pinned: [mix], selectedUri: mix.uri })

    expect(getByRole('combobox', { name: 'Browse' })).toHaveValue(mix.uri)
  })

  it('says the playlists are loading', () => {
    const { getByRole } = renderBrowser({ playlists: [], isLoading: true })

    expect(getByRole('option', { name: 'Loading your playlists…' })).toBeDisabled()
  })
})
