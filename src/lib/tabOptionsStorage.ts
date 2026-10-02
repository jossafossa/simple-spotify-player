const OPTIONS_OPEN_KEY = 'spotify-player:tab-options-open'

export const readTabOptionsOpen = (): boolean => {
  try {
    return localStorage.getItem(OPTIONS_OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

export const saveTabOptionsOpen = (isOpen: boolean): void => {
  try {
    localStorage.setItem(OPTIONS_OPEN_KEY, String(isOpen))
  } catch {
    // The options only start closed again next time.
  }
}
