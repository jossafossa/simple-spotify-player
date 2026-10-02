import { useState } from 'react'
import { useLibraryBackup, type UseLibraryBackupResult } from '~/hooks/useLibraryBackup'
import { useOnlineTabSearch, type UseOnlineTabSearchResult } from '~/hooks/useOnlineTabSearch'
import { useTabData, type UseTabDataResult } from '~/hooks/useTabData'
import { useTabLibrary, type UseTabLibraryResult } from '~/hooks/useTabLibrary'
import {
  cleanSongTitle,
  downloadOnlineTab,
  libraryNameFor,
  type OnlineTab,
} from '~/lib/onlineTabSearch'
import type { SongRef, TabFile, TabSong } from '~/lib/types'

type OpenTab = {
  tabId: string
  song: SongRef | undefined
}

export type UseTabWorkspaceResult = {
  library: UseTabLibraryResult
  backup: UseLibraryBackupResult
  /** How many tabs each song has, by track URI. */
  tabCounts: Record<string, number>
  /** The tab in the viewer, if one is open and still in the library. */
  openTab: (OpenTab & { tab: TabFile; data: UseTabDataResult; songTabs: TabFile[] }) | undefined
  pickerSong: SongRef | undefined
  isLibraryOpen: boolean
  uploadError: string | undefined
  /** Opens a song's first tab, or the picker when it has none yet. */
  openSongTabs: (song: SongRef) => void
  openTabInViewer: (song: SongRef | undefined, tabId: string) => void
  closeViewer: () => void
  openPicker: (song: SongRef) => void
  closePicker: () => void
  openLibrary: () => void
  closeLibrary: () => void
  uploadTab: (file: File, song?: SongRef) => void
  deleteTab: (tab: TabFile) => void
  online: UseOnlineTabSearchResult & {
    addingIds: string[]
    addedIds: string[]
    /** Downloads a found tab into the library and links it to the picker's song. */
    addOnlineTab: (tab: OnlineTab) => void
  }
}

/** What the online search starts with for a song. */
export const onlineQueryFor = (song: SongRef) => ({
  artist: song.artistNames[0] ?? '',
  title: cleanSongTitle(song.name),
})

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not store that file.'

/**
 * Which tab is open and which dialog is showing, on top of the library itself.
 * Kept out of Player so the player stays about playback.
 */
export const useTabWorkspace = (): UseTabWorkspaceResult => {
  const library = useTabLibrary()
  const backup = useLibraryBackup(library.reload)
  const [openTabState, setOpenTabState] = useState<OpenTab>()
  const [pickerSong, setPickerSong] = useState<SongRef>()
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string>()
  const data = useTabData(openTabState?.tabId)
  const onlineSearch = useOnlineTabSearch()
  const [addingIds, setAddingIds] = useState<string[]>([])
  const [addedIds, setAddedIds] = useState<string[]>([])

  const songByUri = new Map<string, TabSong>(library.songs.map((song) => [song.uri, song]))
  const tabById = new Map(library.tabs.map((tab) => [tab.id, tab]))
  const tabCounts = Object.fromEntries(library.songs.map((song) => [song.uri, song.tabIds.length]))

  const openTabFile = openTabState && tabById.get(openTabState.tabId)
  const openSongEntry = openTabState?.song && songByUri.get(openTabState.song.uri)
  const openTab =
    openTabState && openTabFile
      ? {
          ...openTabState,
          tab: openTabFile,
          data,
          songTabs: (openSongEntry?.tabIds ?? []).flatMap((id) => tabById.get(id) ?? []),
        }
      : undefined

  const openTabInViewer = (song: SongRef | undefined, tabId: string) => {
    setOpenTabState({ tabId, song })
    setPickerSong(undefined)
    setIsLibraryOpen(false)
  }

  const openPicker = (song: SongRef) => {
    setUploadError(undefined)
    setIsLibraryOpen(false)
    setAddedIds([])
    setPickerSong(song)
    // Searching costs requests to three sites, so it waits for the button.
    onlineSearch.reset()
  }

  const addOnlineTab = (tab: OnlineTab) => {
    const song = pickerSong
    if (!song) {
      return
    }

    setUploadError(undefined)
    setAddingIds((current) => [...current, tab.id])

    downloadOnlineTab(tab)
      .then((file) => library.addTabFile(file, song, libraryNameFor(tab)))
      .then(() => setAddedIds((current) => [...current, tab.id]))
      .catch((error: unknown) => {
        console.error('Could not add the tab from', tab.source, error)
        setUploadError(describeError(error))
      })
      .finally(() => setAddingIds((current) => current.filter((id) => id !== tab.id)))
  }

  const openSongTabs = (song: SongRef) => {
    const firstTabId = songByUri.get(song.uri)?.tabIds[0]

    if (firstTabId) {
      openTabInViewer(song, firstTabId)
      return
    }

    openPicker(song)
  }

  const uploadTab = (file: File, song?: SongRef) => {
    setUploadError(undefined)
    library.addTabFile(file, song).catch((error: unknown) => {
      console.error('Could not add the tab', error)
      setUploadError(describeError(error))
    })
  }

  const deleteTab = (tab: TabFile) => {
    if (!window.confirm(`Delete “${tab.name}” from the library and every song it is on?`)) {
      return
    }

    void library.removeTab(tab.id)
    if (openTabState?.tabId === tab.id) {
      setOpenTabState(undefined)
    }
  }

  return {
    library,
    backup,
    tabCounts,
    openTab,
    pickerSong,
    isLibraryOpen,
    uploadError,
    openSongTabs,
    openTabInViewer,
    closeViewer: () => setOpenTabState(undefined),
    openPicker,
    closePicker: () => setPickerSong(undefined),
    openLibrary: () => {
      setUploadError(undefined)
      setPickerSong(undefined)
      setIsLibraryOpen(true)
    },
    closeLibrary: () => setIsLibraryOpen(false),
    uploadTab,
    deleteTab,
    online: { ...onlineSearch, addingIds, addedIds, addOnlineTab },
  }
}
