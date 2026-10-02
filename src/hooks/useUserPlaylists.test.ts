import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchUserPlaylists } from '~/lib/spotifyApi'
import { useUserPlaylists } from './useUserPlaylists'

vi.mock('~/lib/spotifyApi', () => ({
  fetchUserPlaylists: vi.fn(),
}))

const mockedFetchUserPlaylists = vi.mocked(fetchUserPlaylists)
const playlists = [{ uri: 'spotify:playlist:mix', name: 'My Mix' }]

describe('useUserPlaylists', () => {
  beforeEach(() => {
    mockedFetchUserPlaylists.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('does not fetch without a token', () => {
    const { result } = renderHook(() => useUserPlaylists(undefined))

    expect(result.current.status).toBe('loading')
    expect(mockedFetchUserPlaylists).not.toHaveBeenCalled()
  })

  it('lists the playlists', async () => {
    mockedFetchUserPlaylists.mockResolvedValue(playlists)

    const { result } = renderHook(() => useUserPlaylists('a-token'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.playlists).toEqual(playlists)
    expect(mockedFetchUserPlaylists).toHaveBeenCalledWith('a-token')
  })

  it('reports a failure', async () => {
    mockedFetchUserPlaylists.mockRejectedValue(new Error('nope'))

    const { result } = renderHook(() => useUserPlaylists('a-token'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.playlists).toEqual([])
  })

  it('keeps the list it has when a refreshed token fails to refetch', async () => {
    mockedFetchUserPlaylists.mockResolvedValueOnce(playlists)
    const { result, rerender } = renderHook(
      ({ token }: { token: string }) => useUserPlaylists(token),
      { initialProps: { token: 'a-token' } },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    mockedFetchUserPlaylists.mockRejectedValueOnce(new Error('nope'))
    rerender({ token: 'b-token' })

    await waitFor(() => expect(mockedFetchUserPlaylists).toHaveBeenCalledTimes(2))
    expect(result.current.status).toBe('ready')
    expect(result.current.playlists).toEqual(playlists)
  })
})
