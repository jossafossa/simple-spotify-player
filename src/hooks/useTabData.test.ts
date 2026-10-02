import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { writeTabLibrary } from '~/lib/tabDatabase'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useTabData } from './useTabData'

describe('useTabData', () => {
  beforeEach(resetTabDatabase)

  it('is idle without a tab', () => {
    expect(renderHook(() => useTabData(undefined)).result.current).toEqual({
      status: 'idle',
      data: undefined,
    })
  })

  it('reads the bytes of the opened tab', async () => {
    await writeTabLibrary({
      tabs: [
        {
          tab: {
            id: 'a',
            name: 'a',
            fileName: 'a.gp5',
            format: 'guitar-pro',
            sizeBytes: 1,
            addedAt: 1,
          },
          data: new Uint8Array([9]).buffer,
        },
      ],
    })

    const { result } = renderHook(() => useTabData('a'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect([...new Uint8Array(result.current.data!)]).toEqual([9])
  })

  it('reports a tab whose bytes are gone', async () => {
    const { result } = renderHook(() => useTabData('gone'))

    await waitFor(() => expect(result.current.status).toBe('missing'))
  })
})
