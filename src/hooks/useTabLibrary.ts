import { useCallback, useEffect, useState } from 'react'
import {
  deleteSong,
  deleteTab,
  readTabLibrary,
  writeSong,
  writeTabLibrary,
} from '~/lib/tabDatabase'
import { detectTabFormat, stripExtension } from '~/lib/tabFormat'
import { deleteTabSettings } from '~/lib/tabSettingsStorage'
import type { SongRef, TabFile, TabSong } from '~/lib/types'

export type TabLibraryStatus = 'loading' | 'ready' | 'error'

export type UseTabLibraryResult = {
  status: TabLibraryStatus
  /** Newest first. */
  tabs: TabFile[]
  /** In the order they were first given a tab. */
  songs: TabSong[]
  /**
   * Stores a file in the library, and links it to the song when one is given.
   * The name defaults to the file name without its extension.
   */
  addTabFile: (file: File, song?: SongRef, name?: string) => Promise<TabFile>
  linkTab: (song: SongRef, tabId: string) => Promise<void>
  unlinkTab: (songUri: string, tabId: string) => Promise<void>
  removeTab: (tabId: string) => Promise<void>
  /** Re-reads everything, for after an import wrote behind this hook's back. */
  reload: () => Promise<void>
}

export class UnsupportedTabFileError extends Error {
  constructor(fileName: string) {
    super(`“${fileName}” is not a Guitar Pro (.gp, .gp3–.gp5, .gpx) or Power Tab (.ptb) file.`)
    this.name = 'UnsupportedTabFileError'
  }
}

const createId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const sortNewestFirst = (tabs: TabFile[]): TabFile[] =>
  [...tabs].sort((a, b) => b.addedAt - a.addedAt)

/**
 * The tab library: every file the user has added and which songs they belong
 * to, kept in IndexedDB so it survives reloads with no server involved.
 */
export const useTabLibrary = (): UseTabLibraryResult => {
  const [status, setStatus] = useState<TabLibraryStatus>('loading')
  const [tabs, setTabs] = useState<TabFile[]>([])
  const [songs, setSongs] = useState<TabSong[]>([])

  const reload = useCallback(async () => {
    try {
      const contents = await readTabLibrary()
      setTabs(sortNewestFirst(contents.tabs))
      setSongs(contents.songs)
      setStatus('ready')
    } catch (error: unknown) {
      console.error('Could not open the tab library', error)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    readTabLibrary()
      .then((contents) => {
        if (!isCancelled) {
          setTabs(sortNewestFirst(contents.tabs))
          setSongs(contents.songs)
          setStatus('ready')
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          console.error('Could not open the tab library', error)
          setStatus('error')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const saveSongTabs = useCallback(async (song: SongRef, tabIds: string[]) => {
    if (tabIds.length === 0) {
      await deleteSong(song.uri)
      setSongs((current) => current.filter((entry) => entry.uri !== song.uri))
      return
    }

    const next: TabSong = {
      uri: song.uri,
      name: song.name,
      artistNames: song.artistNames,
      tabIds,
    }
    await writeSong(next)
    setSongs((current) =>
      current.some((entry) => entry.uri === song.uri)
        ? current.map((entry) => (entry.uri === song.uri ? next : entry))
        : [...current, next],
    )
  }, [])

  const tabIdsOf = useCallback(
    (songUri: string): string[] => songs.find((song) => song.uri === songUri)?.tabIds ?? [],
    [songs],
  )

  const linkTab = useCallback(
    async (song: SongRef, tabId: string) => {
      const current = tabIdsOf(song.uri)
      if (current.includes(tabId)) {
        return
      }

      await saveSongTabs(song, [...current, tabId])
    },
    [saveSongTabs, tabIdsOf],
  )

  const unlinkTab = useCallback(
    async (songUri: string, tabId: string) => {
      const song = songs.find((entry) => entry.uri === songUri)
      if (!song) {
        return
      }

      await saveSongTabs(
        song,
        song.tabIds.filter((id) => id !== tabId),
      )
    },
    [saveSongTabs, songs],
  )

  const addTabFile = useCallback(
    async (file: File, song?: SongRef, name?: string) => {
      const format = detectTabFormat(file.name)
      if (!format) {
        throw new UnsupportedTabFileError(file.name)
      }

      const tab: TabFile = {
        id: createId(),
        name: name ?? stripExtension(file.name),
        fileName: file.name,
        format,
        sizeBytes: file.size,
        addedAt: Date.now(),
      }

      await writeTabLibrary({ tabs: [{ tab, data: await file.arrayBuffer() }] })
      setTabs((current) => [tab, ...current])

      if (song) {
        await saveSongTabs(song, [...tabIdsOf(song.uri), tab.id])
      }

      return tab
    },
    [saveSongTabs, tabIdsOf],
  )

  const removeTab = useCallback(async (tabId: string) => {
    await deleteTab(tabId)
    deleteTabSettings(tabId)
    setTabs((current) => current.filter((tab) => tab.id !== tabId))
    setSongs((current) =>
      current
        .map((song) => ({ ...song, tabIds: song.tabIds.filter((id) => id !== tabId) }))
        .filter((song) => song.tabIds.length > 0),
    )
  }, [])

  return { status, tabs, songs, addTabFile, linkTab, unlinkTab, removeTab, reload }
}
