const SYNC_KEY = 'spotify-player:tab-sync'
const OFFSETS_KEY = 'spotify-player:tab-sync-offsets'

export const readTabSyncEnabled = (): boolean => {
  try {
    return localStorage.getItem(SYNC_KEY) === 'true'
  } catch {
    return false
  }
}

export const saveTabSyncEnabled = (isEnabled: boolean): void => {
  try {
    localStorage.setItem(SYNC_KEY, String(isEnabled))
  } catch {
    // Not remembering it only means switching sync on again next time.
  }
}

const readOffsets = (): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OFFSETS_KEY) ?? '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/**
 * How far a tab's timeline sits from the recording's, in milliseconds. Kept
 * per tab: a file whose intro is two bars short is short every time.
 */
export const readTabSyncOffset = (tabId: string): number => {
  const offset = readOffsets()[tabId]
  return typeof offset === 'number' && Number.isFinite(offset) ? offset : 0
}

export const saveTabSyncOffset = (tabId: string, offsetMs: number): void => {
  try {
    const offsets = readOffsets()
    if (offsetMs === 0) {
      delete offsets[tabId]
    } else {
      offsets[tabId] = offsetMs
    }
    localStorage.setItem(OFFSETS_KEY, JSON.stringify(offsets))
  } catch {
    // The offset is only lost for the next visit.
  }
}
