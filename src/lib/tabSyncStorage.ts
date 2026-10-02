const SYNC_KEY = 'spotify-player:tab-sync'

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
