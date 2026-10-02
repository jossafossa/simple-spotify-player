import { useState } from 'react'
import { FileButton } from '~/components/ui/FileButton'
import { Modal } from '~/components/ui/Modal'
import type { BackupStatus } from '~/hooks/useLibraryBackup'
import { formatFileSize } from '~/lib/formatFileSize'
import { matchesSearch } from '~/lib/matchesSearch'
import { TAB_FILE_ACCEPT } from '~/lib/tabFormat'
import type { TabFile, TabSong } from '~/lib/types'
import styles from './TabLibrary.module.scss'

type TabLibraryProps = {
  songs: TabSong[]
  tabs: TabFile[]
  backupStatus: BackupStatus
  uploadError: string | undefined
  onOpenTab: (song: TabSong | undefined, tabId: string) => void
  onPlaySong: (song: TabSong) => void
  onManageSong: (song: TabSong) => void
  onDeleteTab: (tab: TabFile) => void
  onUpload: (file: File) => void
  onExport: () => void
  onImport: (file: File) => void
  onClose: () => void
}

/** Every song with tabs, every tab file, and the backup of both. */
export const TabLibrary = ({
  songs,
  tabs,
  backupStatus,
  uploadError,
  onOpenTab,
  onPlaySong,
  onManageSong,
  onDeleteTab,
  onUpload,
  onExport,
  onImport,
  onClose,
}: TabLibraryProps) => {
  const [query, setQuery] = useState('')
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]))
  const songsUsing = (tabId: string) => songs.filter((song) => song.tabIds.includes(tabId))

  const visibleSongs = songs.filter((song) =>
    matchesSearch(query, [
      song.name,
      ...song.artistNames,
      ...song.tabIds.map((id) => tabsById.get(id)?.name ?? ''),
    ]),
  )
  const visibleTabs = tabs.filter((tab) => matchesSearch(query, [tab.name, tab.fileName]))
  const isWorking = backupStatus.kind === 'working'
  const count = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`

  return (
    <Modal
      title="Tab library"
      subtitle={`${count(songs.length, 'song')} · ${count(tabs.length, 'tab')} · stored in this browser`}
      onClose={onClose}
    >
      <input
        className={styles.search}
        type="search"
        placeholder="Search songs, artists and tabs…"
        aria-label="Search the library"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <section className={styles.section} aria-label="Songs">
        <h3 className={styles.heading}>Songs</h3>
        {visibleSongs.length === 0 ? (
          <p className={styles.empty}>
            {songs.length === 0
              ? 'No songs have tabs yet. Use the TAB button next to a track to add one.'
              : 'No songs match.'}
          </p>
        ) : (
          <ul className={styles.list}>
            {visibleSongs.map((song) => (
              <li key={song.uri} className={styles.song}>
                <div className={styles.songHeader}>
                  <button
                    type="button"
                    className={styles.play}
                    onClick={() => onPlaySong(song)}
                    aria-label={`Play ${song.name}`}
                  >
                    ▶
                  </button>
                  <span className={styles.songText}>
                    <span className={styles.songName}>{song.name}</span>
                    <span className={styles.artists}>{song.artistNames.join(', ')}</span>
                  </span>
                  <button
                    type="button"
                    className={styles.quiet}
                    onClick={() => onManageSong(song)}
                    aria-label={`Manage tabs for ${song.name}`}
                  >
                    Manage
                  </button>
                </div>
                <div className={styles.chips}>
                  {song.tabIds.map((tabId) => {
                    const tab = tabsById.get(tabId)
                    return (
                      tab && (
                        <button
                          key={tabId}
                          type="button"
                          className={styles.chip}
                          onClick={() => onOpenTab(song, tabId)}
                        >
                          {tab.name}
                        </button>
                      )
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-label="Files">
        <div className={styles.sectionHeader}>
          <h3 className={styles.heading}>Files</h3>
          <FileButton label="Upload" accept={TAB_FILE_ACCEPT} onSelect={onUpload} />
        </div>
        {uploadError && (
          <p className={styles.error} role="alert">
            {uploadError}
          </p>
        )}
        {visibleTabs.length === 0 ? (
          <p className={styles.empty}>{tabs.length === 0 ? 'No tab files yet.' : 'No files match.'}</p>
        ) : (
          <ul className={styles.list}>
            {visibleTabs.map((tab) => {
              const usedBy = songsUsing(tab.id).length
              return (
                <li key={tab.id} className={styles.file}>
                  <button
                    type="button"
                    className={styles.fileName}
                    onClick={() => onOpenTab(undefined, tab.id)}
                  >
                    <span className={styles.songName}>{tab.name}</span>
                    <span className={styles.meta}>
                      {tab.fileName} · {formatFileSize(tab.sizeBytes)} ·{' '}
                      {usedBy === 0 ? 'not on a song' : `on ${usedBy} song${usedBy === 1 ? '' : 's'}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.quiet}
                    onClick={() => onDeleteTab(tab)}
                    aria-label={`Delete ${tab.name}`}
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={styles.backup} aria-label="Backup">
        <h3 className={styles.heading}>Backup</h3>
        <p className={styles.hint}>
          Everything lives in this browser only. Export to keep a copy or move it to
          another browser; importing adds to what is here.
        </p>
        <div className={styles.backupActions}>
          <button type="button" className={styles.ghost} onClick={onExport} disabled={isWorking}>
            Export library
          </button>
          <FileButton
            label="Import library"
            accept=".json,application/json"
            onSelect={onImport}
            disabled={isWorking}
          />
        </div>
        {backupStatus.kind === 'working' && <p className={styles.hint}>Working…</p>}
        {backupStatus.kind === 'done' && <p className={styles.success}>{backupStatus.message}</p>}
        {backupStatus.kind === 'error' && (
          <p className={styles.error} role="alert">
            {backupStatus.message}
          </p>
        )}
      </section>
    </Modal>
  )
}
