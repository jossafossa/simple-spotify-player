import { OnlineTabSearch } from '~/components/feature/OnlineTabSearch'
import { TabLibrary } from '~/components/feature/TabLibrary'
import { TabPicker } from '~/components/feature/TabPicker'
import { TabViewer } from '~/components/feature/TabViewer'
import type { ReactNode } from 'react'
import { onlineQueryFor, type UseTabWorkspaceResult } from '~/hooks/useTabWorkspace'
import type { TabSong } from '~/lib/types'

type TabDialogsProps = {
  workspace: UseTabWorkspaceResult
  onPlaySong: (song: TabSong) => void
}

/** Whichever tab dialog is open: the picker for one song, or the whole library. */
export const TabDialogs = ({ workspace, onPlaySong }: TabDialogsProps) => {
  const { library, backup, pickerSong } = workspace

  if (pickerSong) {
    const linkedTabIds = library.songs.find((song) => song.uri === pickerSong.uri)?.tabIds ?? []

    return (
      <TabPicker
        song={pickerSong}
        tabs={library.tabs}
        linkedTabIds={linkedTabIds}
        uploadError={workspace.uploadError}
        onLink={(tabId) => void library.linkTab(pickerSong, tabId)}
        onUnlink={(tabId) => void library.unlinkTab(pickerSong.uri, tabId)}
        onUpload={(file) => workspace.uploadTab(file, pickerSong)}
        onOpen={(tabId) => workspace.openTabInViewer(pickerSong, tabId)}
        onClose={workspace.closePicker}
        onlineSearch={
          <OnlineTabSearch
            // Fresh fields per song, starting from its artist and title.
            key={pickerSong.uri}
            song={pickerSong}
            initialQuery={onlineQueryFor(pickerSong)}
            state={workspace.online.state}
            addingIds={workspace.online.addingIds}
            addedIds={workspace.online.addedIds}
            onSearch={workspace.online.search}
            onAdd={workspace.online.addOnlineTab}
          />
        }
      />
    )
  }

  if (workspace.isLibraryOpen) {
    return (
      <TabLibrary
        songs={library.songs}
        tabs={library.tabs}
        backupStatus={backup.status}
        uploadError={workspace.uploadError}
        onOpenTab={workspace.openTabInViewer}
        onPlaySong={onPlaySong}
        onManageSong={workspace.openPicker}
        onDeleteTab={workspace.deleteTab}
        onUpload={(file) => workspace.uploadTab(file)}
        onExport={() => void backup.exportLibrary()}
        onImport={(file) => void backup.importLibrary(file)}
        onClose={workspace.closeLibrary}
      />
    )
  }

  return null
}

type TabViewerSlotProps = {
  workspace: UseTabWorkspaceResult
  playbackControls?: ReactNode
}

export const TabViewerSlot = ({ workspace, playbackControls }: TabViewerSlotProps) => {
  const { openTab } = workspace

  if (!openTab) {
    return null
  }

  const { song } = openTab

  return (
    <TabViewer
      // A fresh viewer per file, so alphaTab never mixes two scores' state.
      key={openTab.tab.id}
      tab={openTab.tab}
      data={openTab.data.data}
      dataStatus={openTab.data.status}
      song={song}
      songTabs={openTab.songTabs}
      playbackControls={playbackControls}
      onSelectTab={(tabId) => workspace.openTabInViewer(song, tabId)}
      onManage={song ? () => workspace.openPicker(song) : undefined}
      onClose={workspace.closeViewer}
    />
  )
}
