import { useState } from 'react'
import { useBackButtonCloses } from '~/hooks/useBackButtonCloses'
import { useLibraryBackup, type UseLibraryBackupResult } from '~/hooks/useLibraryBackup'
import { useOnlineTabSearch, type UseOnlineTabSearchResult } from '~/hooks/useOnlineTabSearch'
import { useTabData, type UseTabDataResult } from '~/hooks/useTabData'
import { useTabFingerprints } from '~/hooks/useTabFingerprints'
import { useTabPreview, type TabPreview } from '~/hooks/useTabPreview'
import { useTabLibrary, type UseTabLibraryResult } from '~/hooks/useTabLibrary'
import {
  cleanSongTitle,
  downloadOnlineTab,
  libraryNameFor,
  type OnlineTab,
} from '~/lib/onlineTabSearch'
import { findSameSong } from '~/lib/songMatch'
import { readLastTabId, saveLastTabId } from '~/lib/songTabStorage'
import type { SongRef, TabFile, TabSong } from '~/lib/types'

type OpenTab = {
  tabId: string
  song: SongRef | undefined
}

export type UseTabWorkspaceResult = {
  library: UseTabLibraryResult
  /** Fingerprints of library tabs that may be copies of each other, by tab id. */
  fingerprints: Record<string, string>
  backup: UseLibraryBackupResult
  /** How many tabs the song has — matched across relinked copies and remasters. */
  tabCountFor: (song: SongRef) => number
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
  /** A tab being looked at before it is added to the picker's song. */
  preview: TabPreview | undefined
  previewLibraryTab: (tabId: string) => void
  previewOnlineTab: (tab: OnlineTab) => void
  /** Opens the song's first tab in the viewer, or closes the viewer when it has none. */
  showTabFor: (song: SongRef) => void
  /** Back from the preview to the picker it came from. */
  closePreview: () => void
  /** Adds the previewed tab to the song, and goes on showing it as a linked tab. */
  addPreviewed: () => void
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
  // Library tabs the size of a file found online are compared with it too.
  const onlineSizes =
    onlineSearch.state.kind === 'done'
      ? onlineSearch.state.results.flatMap((tab) => tab.sizeBytes ?? [])
      : []
  const fingerprints = useTabFingerprints(library.tabs, onlineSizes)
  const tabPreview = useTabPreview(library)
  const [addingIds, setAddingIds] = useState<string[]>([])
  const [addedIds, setAddedIds] = useState<string[]>([])

  const tabById = new Map(library.tabs.map((tab) => [tab.id, tab]))
  const songEntryFor = (song: SongRef): TabSong | undefined => findSameSong(song, library.songs)
  const tabCountFor = (song: SongRef): number => songEntryFor(song)?.tabIds.length ?? 0
  // A song already in the library keeps its entry, whichever copy of it is
  // asked about, so its tabs never split across two URIs.
  const resolveSong = (song: SongRef): SongRef => songEntryFor(song) ?? song
  // The tab last opened for the song, as long as it is still on it.
  const preferredTabIdFor = (song: SongRef): string | undefined => {
    const entry = songEntryFor(song)
    if (!entry) {
      return undefined
    }

    const lastTabId = readLastTabId(entry.uri)
    return lastTabId && entry.tabIds.includes(lastTabId) ? lastTabId : entry.tabIds[0]
  }

  const openTabFile = openTabState && tabById.get(openTabState.tabId)
  const openSongEntry = openTabState?.song && songEntryFor(openTabState.song)
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
    const resolved = song && resolveSong(song)
    if (resolved) {
      saveLastTabId(resolved.uri, tabId)
    }
    setOpenTabState({ tabId, song: resolved })
    setPickerSong(undefined)
    setIsLibraryOpen(false)
  }

  const openPicker = (song: SongRef) => {
    setUploadError(undefined)
    setIsLibraryOpen(false)
    setAddedIds([])
    setPickerSong(resolveSong(song))
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
    const tabId = preferredTabIdFor(song)

    if (tabId) {
      openTabInViewer(song, tabId)
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

  // Topmost first: a preview covers the picker, which covers the open tab.
  useBackButtonCloses(
    tabPreview.preview
      ? tabPreview.closePreview
      : pickerSong
        ? () => setPickerSong(undefined)
        : isLibraryOpen
          ? () => setIsLibraryOpen(false)
          : openTab
            ? () => setOpenTabState(undefined)
            : undefined,
  )

  return {
    library,
    fingerprints,
    backup,
    tabCountFor,
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
    showTabFor: (song) => {
      const tabId = preferredTabIdFor(song)
      if (tabId) {
        openTabInViewer(song, tabId)
      } else {
        setOpenTabState(undefined)
      }
    },
    preview: tabPreview.preview,
    previewLibraryTab: (tabId) => {
      if (pickerSong) {
        tabPreview.previewLibraryTab(tabId, pickerSong)
      }
    },
    previewOnlineTab: (tab) => {
      if (pickerSong) {
        tabPreview.previewOnlineTab(tab, pickerSong)
      }
    },
    closePreview: tabPreview.closePreview,
    addPreviewed: () => {
      const song = tabPreview.preview?.song
      setUploadError(undefined)
      tabPreview
        .addPreviewed()
        .then((tabId) => {
          tabPreview.closePreview()
          if (song && tabId) {
            openTabInViewer(song, tabId)
          }
        })
        .catch((error: unknown) => {
          console.error('Could not add the previewed tab', error)
          tabPreview.closePreview()
          setUploadError(describeError(error))
        })
    },
    online: { ...onlineSearch, addingIds, addedIds, addOnlineTab },
  }
}
