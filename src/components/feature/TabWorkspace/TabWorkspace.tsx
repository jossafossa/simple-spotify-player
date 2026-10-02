import { OnlineTabSearch } from '~/components/feature/OnlineTabSearch'
import { TabLibrary } from '~/components/feature/TabLibrary'
import { TabPicker } from '~/components/feature/TabPicker'
import { TabViewer, type SpotifyPlayback } from '~/components/feature/TabViewer'
import { onlineQueryFor, type UseTabWorkspaceResult } from '~/hooks/useTabWorkspace'
import type { SongRef, TabSong } from '~/lib/types'

type TabDialogsProps = {
  workspace: UseTabWorkspaceResult
  onPlaySong: (song: TabSong) => void
}

/** Whichever tab dialog is open: the picker for one song, or the whole library. */
export const TabDialogs = ({ workspace, onPlaySong }: TabDialogsProps) => {
  const { library, backup, pickerSong } = workspace

  // The preview covers the page; the picker it came from waits underneath.
  if (workspace.preview) {
    return null
  }

  if (pickerSong) {
    // The picker's song is already resolved to its library entry, if it has one.
    const linkedTabIds = library.songs.find((song) => song.uri === pickerSong.uri)?.tabIds ?? []

    return (
      <TabPicker
        song={pickerSong}
        tabs={library.tabs}
        fingerprints={workspace.fingerprints}
        linkedTabIds={linkedTabIds}
        uploadError={workspace.uploadError}
        onLink={(tabId) => void library.linkTab(pickerSong, tabId)}
        onUnlink={(tabId) => void library.unlinkTab(pickerSong.uri, tabId)}
        onUpload={(file) => workspace.uploadTab(file, pickerSong)}
        onOpen={(tabId) => workspace.openTabInViewer(pickerSong, tabId)}
        onPreview={workspace.previewLibraryTab}
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
            onPreview={workspace.previewOnlineTab}
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
  spotifyPlayback?: SpotifyPlayback
  loadSongBpm?: (song: SongRef) => Promise<number | undefined>
}

export const TabViewerSlot = ({
  workspace,
  spotifyPlayback,
  loadSongBpm,
}: TabViewerSlotProps) => {
  const { openTab, preview } = workspace

  if (preview) {
    return (
      <TabViewer
        key={preview.tab.id}
        tab={preview.tab}
        data={preview.data}
        dataStatus={preview.dataStatus}
        song={preview.song}
        songTabs={[]}
        spotifyPlayback={spotifyPlayback}
        preview={{ onAdd: workspace.addPreviewed, isAdding: preview.isAdding }}
        loadSongBpm={loadSongBpm}
        onSelectTab={() => {}}
        onManage={undefined}
        onClose={workspace.closePreview}
      />
    )
  }

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
      spotifyPlayback={spotifyPlayback}
      loadSongBpm={loadSongBpm}
      onSelectTab={(tabId) => workspace.openTabInViewer(song, tabId)}
      onManage={song ? () => workspace.openPicker(song) : undefined}
      onClose={workspace.closeViewer}
    />
  )
}
