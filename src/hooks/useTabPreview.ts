import { useState } from 'react'
import { useTabData, type TabDataStatus } from '~/hooks/useTabData'
import type { UseTabLibraryResult } from '~/hooks/useTabLibrary'
import { downloadOnlineTab, libraryNameFor, type OnlineTab } from '~/lib/onlineTabSearch'
import { detectTabFormat } from '~/lib/tabFormat'
import type { SongRef, TabFile } from '~/lib/types'

type PreviewTarget =
  | { kind: 'library'; tabId: string; song: SongRef }
  | { kind: 'online'; online: OnlineTab; song: SongRef }

type OnlineDownload = {
  onlineId: string
  status: 'ready' | 'error'
  file: File | undefined
  data: ArrayBuffer | undefined
}

/** A tab shown before it is added: nothing is stored or linked until `add`. */
export type TabPreview = {
  tab: TabFile
  data: ArrayBuffer | undefined
  dataStatus: TabDataStatus
  /** The song it would be added to. */
  song: SongRef
  isAdding: boolean
}

export type UseTabPreviewResult = {
  preview: TabPreview | undefined
  previewLibraryTab: (tabId: string, song: SongRef) => void
  previewOnlineTab: (online: OnlineTab, song: SongRef) => void
  closePreview: () => void
  /** Adds the previewed tab to its song; resolves with the stored tab's id. */
  addPreviewed: () => Promise<string | undefined>
}

/** A stand-in library entry for a file that is only in memory, so the viewer can show it. */
const toPreviewFile = (online: OnlineTab, file: File | undefined): TabFile => ({
  id: `preview:${online.id}`,
  name: libraryNameFor(online),
  fileName: file?.name ?? `${online.title}.gp5`,
  format: (file && detectTabFormat(file.name)) || 'guitar-pro',
  sizeBytes: file?.size ?? 0,
  addedAt: 0,
})

/**
 * Previewing a tab — one from the library not yet on the song, or one found
 * online — before deciding to add it. An online file is downloaded once into
 * memory and, if added, stored from there rather than fetched again.
 */
export const useTabPreview = (library: UseTabLibraryResult): UseTabPreviewResult => {
  const [target, setTarget] = useState<PreviewTarget>()
  const [download, setDownload] = useState<OnlineDownload>()
  const [isAdding, setIsAdding] = useState(false)
  const libraryData = useTabData(target?.kind === 'library' ? target.tabId : undefined)

  const previewOnlineTab = (online: OnlineTab, song: SongRef) => {
    setTarget({ kind: 'online', online, song })
    setDownload(undefined)

    downloadOnlineTab(online)
      .then(async (file) => {
        const data = await file.arrayBuffer()
        setDownload({ onlineId: online.id, status: 'ready', file, data })
      })
      .catch((error: unknown) => {
        console.error('Could not download the tab to preview', error)
        setDownload({ onlineId: online.id, status: 'error', file: undefined, data: undefined })
      })
  }

  const preview = ((): TabPreview | undefined => {
    if (!target) {
      return undefined
    }

    if (target.kind === 'library') {
      const tab = library.tabs.find((entry) => entry.id === target.tabId)
      return (
        tab && {
          tab,
          data: libraryData.data,
          dataStatus: libraryData.status,
          song: target.song,
          isAdding,
        }
      )
    }

    const current = download?.onlineId === target.online.id ? download : undefined
    return {
      tab: toPreviewFile(target.online, current?.file),
      data: current?.data,
      dataStatus: current?.status ?? 'loading',
      song: target.song,
      isAdding,
    }
  })()

  const addPreviewed = async (): Promise<string | undefined> => {
    if (!target) {
      return undefined
    }

    setIsAdding(true)
    try {
      if (target.kind === 'library') {
        await library.linkTab(target.song, target.tabId)
        return target.tabId
      }

      const file = download?.onlineId === target.online.id ? download.file : undefined
      const stored = await library.addTabFile(
        file ?? (await downloadOnlineTab(target.online)),
        target.song,
        libraryNameFor(target.online),
      )
      return stored.id
    } finally {
      setIsAdding(false)
    }
  }

  return {
    preview,
    previewLibraryTab: (tabId, song) => setTarget({ kind: 'library', tabId, song }),
    previewOnlineTab,
    closePreview: () => {
      setTarget(undefined)
      setDownload(undefined)
    },
    addPreviewed,
  }
}
