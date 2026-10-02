import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchOnlineTabs, TabSearchUnavailableError } from '~/lib/onlineTabSearch'
import { useOnlineTabSearch } from './useOnlineTabSearch'

vi.mock('~/lib/onlineTabSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/onlineTabSearch')>()),
  searchOnlineTabs: vi.fn(),
}))

const mockedSearch = vi.mocked(searchOnlineTabs)
const query = { artist: 'Nightwish', title: 'Nemo' }

describe('useOnlineTabSearch', () => {
  beforeEach(() => {
    mockedSearch.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('searches and keeps the results with the query', async () => {
    mockedSearch.mockResolvedValue({ results: [], failures: [] })
    const { result } = renderHook(() => useOnlineTabSearch())

    act(() => result.current.search(query))
    expect(result.current.state).toEqual({ kind: 'searching', query })

    await waitFor(() => expect(result.current.state.kind).toBe('done'))
    expect(result.current.state).toEqual({ kind: 'done', query, results: [], failures: [] })
  })

  it('only lets the latest search land', async () => {
    let finishFirst: (value: { results: never[]; failures: never[] }) => void = () => {}
    mockedSearch
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce({ results: [], failures: [] })
    const { result } = renderHook(() => useOnlineTabSearch())

    act(() => result.current.search({ artist: '', title: 'first' }))
    act(() => result.current.search({ artist: '', title: 'second' }))
    await waitFor(() => expect(result.current.state.kind).toBe('done'))
    await act(async () => finishFirst({ results: [], failures: [] }))

    expect(result.current.state).toMatchObject({ query: { title: 'second' } })
  })

  it('says when the service is not running', async () => {
    mockedSearch.mockRejectedValue(new TabSearchUnavailableError())
    const { result } = renderHook(() => useOnlineTabSearch())

    act(() => result.current.search(query))

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'unavailable' }))
  })

  it('passes other failures on, and resets', async () => {
    mockedSearch.mockRejectedValue(new Error('A title is needed.'))
    const { result } = renderHook(() => useOnlineTabSearch())

    act(() => result.current.search(query))
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'error', message: 'A title is needed.' }),
    )

    act(() => result.current.reset())
    expect(result.current.state).toEqual({ kind: 'idle' })
  })
})
