const LAST_TAB_KEY = 'spotify-player:song-last-tab'

const readAll = (): Record<string, string> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LAST_TAB_KEY) ?? 'null')
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}

/** The tab last opened for a song, by the song's URI. */
export const readLastTabId = (songUri: string): string | undefined => readAll()[songUri]

export const saveLastTabId = (songUri: string, tabId: string): void => {
  try {
    localStorage.setItem(LAST_TAB_KEY, JSON.stringify({ ...readAll(), [songUri]: tabId }))
  } catch {
    // The song only opens on its first tab again next time.
  }
}
