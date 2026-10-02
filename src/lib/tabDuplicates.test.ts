import { describe, expect, it, vi } from 'vitest'
import { fingerprintPossibleDuplicates, withoutDuplicates } from './tabDuplicates'
import type { TabFile } from './types'

const buildTab = (id: string, sizeBytes: number, addedAt = 1): TabFile => ({
  id,
  name: id,
  fileName: `${id}.gp5`,
  format: 'guitar-pro',
  sizeBytes,
  addedAt,
})

const bytes = (...values: number[]) => new Uint8Array(values).buffer

describe('fingerprintPossibleDuplicates', () => {
  it('only reads tabs that share their size with another', async () => {
    const files: Record<string, ArrayBuffer> = {
      a: bytes(1, 2, 3),
      b: bytes(1, 2, 3),
      c: bytes(9, 9, 9),
      lone: bytes(1),
    }
    const readData = vi.fn((id: string) => Promise.resolve(files[id]))

    const fingerprints = await fingerprintPossibleDuplicates(
      [buildTab('a', 3), buildTab('b', 3), buildTab('c', 3), buildTab('lone', 1)],
      readData,
    )

    expect(readData).not.toHaveBeenCalledWith('lone')
    expect(fingerprints.a).toBe(fingerprints.b)
    expect(fingerprints.c).not.toBe(fingerprints.a)
    expect(fingerprints.lone).toBeUndefined()
  })

  it('skips a tab whose file is gone', async () => {
    const fingerprints = await fingerprintPossibleDuplicates([buildTab('a', 3), buildTab('b', 3)], (id) =>
      Promise.resolve(id === 'a' ? bytes(1, 2, 3) : undefined),
    )

    expect(Object.keys(fingerprints)).toEqual(['a'])
  })
})

describe('withoutDuplicates', () => {
  const original = buildTab('original', 3, 1)
  const copy = buildTab('copy', 3, 2)
  const other = buildTab('other', 3, 3)
  const fingerprints = { original: 'same', copy: 'same', other: 'different' }

  it('keeps the tab added first of a file listed twice, whatever the order', () => {
    expect(withoutDuplicates([copy, other, original], [], fingerprints)).toEqual([other, original])
  })

  it('leaves out a copy of a file already on the song', () => {
    expect(withoutDuplicates([copy, other], [original], fingerprints)).toEqual([other])
  })

  it('keeps tabs it has no fingerprint for', () => {
    const unknown = buildTab('unknown', 7)

    expect(withoutDuplicates([unknown, copy], [], fingerprints)).toEqual([unknown, copy])
  })
})
