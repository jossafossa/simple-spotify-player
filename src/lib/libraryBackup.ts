import type { TabWithData } from './tabDatabase'
import type { PlaylistSummary, TabFile, TabSong } from './types'

const BACKUP_APP = 'simple-spotify-player'
const BACKUP_VERSION = 1

type BackupTab = TabFile & { dataBase64: string }

export type LibraryBackup = {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  tabs: BackupTab[]
  songs: TabSong[]
  pinnedPlaylists: PlaylistSummary[]
}

export type RestoredLibrary = {
  tabs: TabWithData[]
  songs: TabSong[]
  pinnedPlaylists: PlaylistSummary[]
}

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`This is not a backup this app can read: ${reason}`)
    this.name = 'InvalidBackupError'
  }
}

/** Chunked, because spreading a multi-megabyte array into one call overflows the stack. */
const toBase64 = (data: ArrayBuffer): string => {
  const bytes = new Uint8Array(data)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

const fromBase64 = (base64: string): ArrayBuffer => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

export const buildLibraryBackup = ({
  tabs,
  songs,
  pinnedPlaylists,
}: RestoredLibrary): LibraryBackup => ({
  app: BACKUP_APP,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  tabs: tabs.map(({ tab, data }) => ({ ...tab, dataBase64: toBase64(data) })),
  songs,
  pinnedPlaylists,
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const isBackupTab = (value: unknown): value is BackupTab =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.fileName === 'string' &&
  (value.format === 'guitar-pro' || value.format === 'power-tab') &&
  typeof value.sizeBytes === 'number' &&
  typeof value.addedAt === 'number' &&
  typeof value.dataBase64 === 'string'

const isTabSong = (value: unknown): value is TabSong =>
  isObject(value) &&
  typeof value.uri === 'string' &&
  typeof value.name === 'string' &&
  isStringArray(value.artistNames) &&
  isStringArray(value.tabIds)

const isPlaylistSummary = (value: unknown): value is PlaylistSummary =>
  isObject(value) && typeof value.uri === 'string' && typeof value.name === 'string'

/** Validates every record before anything is written, so a bad file changes nothing. */
export const parseLibraryBackup = (text: string): RestoredLibrary => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new InvalidBackupError('it is not JSON')
  }

  if (!isObject(parsed) || parsed.app !== BACKUP_APP) {
    throw new InvalidBackupError('it was not exported from this app')
  }

  if (parsed.version !== BACKUP_VERSION) {
    throw new InvalidBackupError(`it has version ${String(parsed.version)}`)
  }

  const { tabs, songs, pinnedPlaylists } = parsed

  if (!Array.isArray(tabs) || !tabs.every(isBackupTab)) {
    throw new InvalidBackupError('its tabs are damaged')
  }

  if (!Array.isArray(songs) || !songs.every(isTabSong)) {
    throw new InvalidBackupError('its songs are damaged')
  }

  if (!Array.isArray(pinnedPlaylists) || !pinnedPlaylists.every(isPlaylistSummary)) {
    throw new InvalidBackupError('its pinned playlists are damaged')
  }

  return {
    tabs: tabs.map(({ dataBase64, ...tab }) => {
      try {
        return { tab, data: fromBase64(dataBase64) }
      } catch {
        throw new InvalidBackupError(`the file for “${tab.name}” is damaged`)
      }
    }),
    songs,
    pinnedPlaylists,
  }
}

/**
 * Importing adds to what is there rather than replacing it: tabs with the same
 * id are overwritten, a song keeps the tabs it had plus the imported ones, and
 * pins are appended.
 */
export const mergeSongs = (existing: TabSong[], imported: TabSong[]): TabSong[] => {
  const byUri = new Map(existing.map((song) => [song.uri, song]))

  return imported.map((song) => {
    const current = byUri.get(song.uri)
    return current
      ? { ...song, tabIds: [...new Set([...current.tabIds, ...song.tabIds])] }
      : song
  })
}

export const mergePinnedPlaylists = (
  existing: PlaylistSummary[],
  imported: PlaylistSummary[],
): PlaylistSummary[] => {
  const known = new Set(existing.map((playlist) => playlist.uri))
  return [...existing, ...imported.filter((playlist) => !known.has(playlist.uri))]
}
