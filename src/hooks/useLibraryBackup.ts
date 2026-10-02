import { useState } from 'react'
import {
  buildLibraryBackup,
  mergePinnedPlaylists,
  mergeSongs,
  mergeTabSettings,
  parseLibraryBackup,
} from '~/lib/libraryBackup'
import { readAllTabSettings, writeAllTabSettings } from '~/lib/tabSettingsStorage'
import { readPinnedPlaylists, savePinnedPlaylists } from '~/lib/pinnedPlaylistsStorage'
import { readTabData, readTabLibrary, writeTabLibrary, type TabWithData } from '~/lib/tabDatabase'

export type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

export type UseLibraryBackupResult = {
  status: BackupStatus
  exportLibrary: () => Promise<void>
  importLibrary: (file: File) => Promise<void>
}

const backupFileName = (): string =>
  `spotify-player-library-${new Date().toISOString().slice(0, 10)}.json`

/** Hands the browser a file to save, without a server to download it from. */
const saveFile = (contents: string, fileName: string): void => {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * Export and import of everything this app stores — tab files, which songs
 * they belong to, and pinned playlists — as one JSON file.
 */
export const useLibraryBackup = (onImported: () => Promise<void>): UseLibraryBackupResult => {
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' })

  const exportLibrary = async () => {
    setStatus({ kind: 'working' })

    try {
      const { tabs, songs } = await readTabLibrary()
      const tabsWithData: TabWithData[] = []

      for (const tab of tabs) {
        const data = await readTabData(tab.id)
        if (data) {
          tabsWithData.push({ tab, data })
        }
      }

      const backup = buildLibraryBackup({
        tabs: tabsWithData,
        songs,
        pinnedPlaylists: readPinnedPlaylists(),
        tabSettings: readAllTabSettings(),
      })
      saveFile(JSON.stringify(backup), backupFileName())
      setStatus({
        kind: 'done',
        message: `Exported ${plural(tabsWithData.length, 'tab')} and ${plural(songs.length, 'song')}.`,
      })
    } catch (error: unknown) {
      console.error('Could not export the library', error)
      setStatus({ kind: 'error', message: 'Could not export the library.' })
    }
  }

  const importLibrary = async (file: File) => {
    setStatus({ kind: 'working' })

    try {
      const restored = parseLibraryBackup(await file.text())
      const existing = await readTabLibrary()

      await writeTabLibrary({
        tabs: restored.tabs,
        songs: mergeSongs(existing.songs, restored.songs),
      })
      savePinnedPlaylists(mergePinnedPlaylists(readPinnedPlaylists(), restored.pinnedPlaylists))
      writeAllTabSettings(mergeTabSettings(readAllTabSettings(), restored.tabSettings))
      await onImported()

      setStatus({
        kind: 'done',
        message: `Imported ${plural(restored.tabs.length, 'tab')} and ${plural(restored.songs.length, 'song')}.`,
      })
    } catch (error: unknown) {
      console.error('Could not import the library', error)
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not import the library.',
      })
    }
  }

  return { status, exportLibrary, importLibrary }
}
