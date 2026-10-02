import { describe, expect, it, vi } from 'vitest'
import { createFetchFile, NotDownloadableError } from './files.ts'
import type { FileSource } from './types.ts'

const fileSource = (): FileSource => ({
  pathPattern: /^\/tabs\/\d+$/,
  fetchFile: vi.fn((path: string) => Promise.resolve({ data: new Uint8Array([1]), fileName: `${path.slice(6)}.gp5` })),
})

describe('createFetchFile', () => {
  it('fetches a file once, then hands out the same one for a while', async () => {
    const gprotab = fileSource()
    const fetchFile = createFetchFile(vi.fn() as unknown as typeof fetch, { gprotab })

    const first = await fetchFile('gprotab', '/tabs/1')
    const second = await fetchFile('gprotab', '/tabs/1')

    expect(second).toBe(first)
    expect(gprotab.fetchFile).toHaveBeenCalledOnce()
  })

  it('refuses a source without files, and a path not shaped like its tabs', async () => {
    const fetchFile = createFetchFile(vi.fn() as unknown as typeof fetch, { gprotab: fileSource() })

    await expect(fetchFile('songsterr', '/tabs/1')).rejects.toBeInstanceOf(NotDownloadableError)
    await expect(fetchFile('gprotab', '/admin')).rejects.toBeInstanceOf(NotDownloadableError)
    await expect(fetchFile('__proto__' as 'gprotab', '/tabs/1')).rejects.toBeInstanceOf(NotDownloadableError)
  })

  it('asks again after a failure', async () => {
    const gprotab = fileSource()
    vi.mocked(gprotab.fetchFile).mockRejectedValueOnce(new Error('down'))
    const fetchFile = createFetchFile(vi.fn() as unknown as typeof fetch, { gprotab })

    await expect(fetchFile('gprotab', '/tabs/1')).rejects.toThrow('down')
    await expect(fetchFile('gprotab', '/tabs/1')).resolves.toMatchObject({ fileName: '1.gp5' })
  })
})
