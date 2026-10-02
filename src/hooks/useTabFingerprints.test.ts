import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { writeTabLibrary } from '~/lib/tabDatabase'
import type { TabFile } from '~/lib/types'
import { resetTabDatabase } from '~/test/resetTabDatabase'
import { useTabFingerprints } from './useTabFingerprints'

const buildTab = (id: string, sizeBytes: number): TabFile => ({
  id,
  name: id,
  fileName: `${id}.gp5`,
  format: 'guitar-pro',
  sizeBytes,
  addedAt: 1,
})

describe('useTabFingerprints', () => {
  beforeEach(async () => {
    await resetTabDatabase()
  })

  it('gives copies of one file the same fingerprint', async () => {
    const tabs = [buildTab('a', 2), buildTab('b', 2), buildTab('c', 2)]
    await writeTabLibrary({
      tabs: [
        { tab: tabs[0]!, data: new Uint8Array([1, 2]).buffer },
        { tab: tabs[1]!, data: new Uint8Array([1, 2]).buffer },
        { tab: tabs[2]!, data: new Uint8Array([3, 4]).buffer },
      ],
    })

    const { result } = renderHook(() => useTabFingerprints(tabs))

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(3))
    expect(result.current.a).toBe(result.current.b)
    expect(result.current.c).not.toBe(result.current.a)
  })
})
