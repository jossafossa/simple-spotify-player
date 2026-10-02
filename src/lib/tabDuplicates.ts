import type { TabFile } from './types'

const toHex = (digest: ArrayBuffer): string =>
  [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

/**
 * A fingerprint of the file behind each tab that may have a twin. Only tabs
 * sharing their size with another are read and hashed: a file of another
 * size cannot be the same file, and reading every tab would be slow.
 */
export const fingerprintPossibleDuplicates = async (
  tabs: TabFile[],
  readData: (tabId: string) => Promise<ArrayBuffer | undefined>,
): Promise<Record<string, string>> => {
  const countBySize = new Map<number, number>()
  for (const tab of tabs) {
    countBySize.set(tab.sizeBytes, (countBySize.get(tab.sizeBytes) ?? 0) + 1)
  }

  const sameSized = tabs.filter((tab) => (countBySize.get(tab.sizeBytes) ?? 0) > 1)
  const entries = await Promise.all(
    sameSized.map(async (tab): Promise<[string, string][]> => {
      const data = await readData(tab.id)
      return data ? [[tab.id, toHex(await crypto.subtle.digest('SHA-256', data))]] : []
    }),
  )

  return Object.fromEntries(entries.flat())
}

/**
 * Leaves out tabs whose file is already on the song, or is also in the list
 * under a tab added earlier — that one stays, as the original.
 */
export const withoutDuplicates = (
  candidates: TabFile[],
  linkedTabs: TabFile[],
  fingerprints: Record<string, string>,
): TabFile[] => {
  const keptByFingerprint = new Map<string, TabFile>()
  for (const tab of candidates) {
    const fingerprint = fingerprints[tab.id]
    const kept = fingerprint && keptByFingerprint.get(fingerprint)
    if (fingerprint && (!kept || tab.addedAt < kept.addedAt)) {
      keptByFingerprint.set(fingerprint, tab)
    }
  }

  const linkedFingerprints = new Set(linkedTabs.flatMap((tab) => fingerprints[tab.id] ?? []))

  return candidates.filter((tab) => {
    const fingerprint = fingerprints[tab.id]
    if (!fingerprint) {
      return true
    }

    return !linkedFingerprints.has(fingerprint) && keptByFingerprint.get(fingerprint) === tab
  })
}
