import type { PlaylistSummary } from './types'

const PINNED_KEY = 'spotify-player:pinned-playlists'
/** Lets every hook holding the pins catch up when an import rewrites them. */
export const PINNED_PLAYLISTS_CHANGED_EVENT = 'spotify-player:pinned-playlists-changed'

const isPlaylistSummary = (value: unknown): value is PlaylistSummary =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PlaylistSummary).uri === 'string' &&
  typeof (value as PlaylistSummary).name === 'string'

/**
 * The name is stored alongside the URI so the pins can be drawn before the
 * playlist listing has loaded — or when it fails to.
 */
export const readPinnedPlaylists = (): PlaylistSummary[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPlaylistSummary) : []
  } catch {
    return []
  }
}

export const savePinnedPlaylists = (playlists: PlaylistSummary[]): void => {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(playlists))
  } catch {
    // A browser refusing storage only costs the pins on the next visit.
  }

  window.dispatchEvent(new Event(PINNED_PLAYLISTS_CHANGED_EVENT))
}
