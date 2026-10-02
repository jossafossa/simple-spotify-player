import { useState, type ReactNode } from 'react'
import { FileButton } from '~/components/ui/FileButton'
import { Modal } from '~/components/ui/Modal'
import { formatFileSize } from '~/lib/formatFileSize'
import { matchesSearch } from '~/lib/matchesSearch'
import { TAB_FILE_ACCEPT } from '~/lib/tabFormat'
import type { SongRef, TabFile } from '~/lib/types'
import styles from './TabPicker.module.scss'

type TabPickerProps = {
  song: SongRef
  tabs: TabFile[]
  linkedTabIds: string[]
  /** Set when the last upload was refused, e.g. for an unknown file type. */
  uploadError: string | undefined
  onLink: (tabId: string) => void
  onUnlink: (tabId: string) => void
  onUpload: (file: File) => void
  onOpen: (tabId: string) => void
  /** Shows a library tab full page before it is added. */
  onPreview?: (tabId: string) => void
  onClose: () => void
  /** The online search, placed between the library and the upload. */
  onlineSearch?: ReactNode
}

const FORMAT_LABELS: Record<TabFile['format'], string> = {
  'guitar-pro': 'Guitar Pro',
  'power-tab': 'Power Tab',
}

const describeTab = (tab: TabFile): string =>
  `${FORMAT_LABELS[tab.format]} · ${formatFileSize(tab.sizeBytes)}`

/** "Add a tab to this song": the song's tabs, then the library to pick more from. */
export const TabPicker = ({
  song,
  tabs,
  linkedTabIds,
  uploadError,
  onLink,
  onUnlink,
  onUpload,
  onOpen,
  onPreview,
  onClose,
  onlineSearch,
}: TabPickerProps) => {
  const [query, setQuery] = useState('')
  const linkedTabs = linkedTabIds.flatMap((id) => tabs.filter((tab) => tab.id === id))
  const candidates = tabs.filter(
    (tab) => !linkedTabIds.includes(tab.id) && matchesSearch(query, [tab.name, tab.fileName]),
  )

  return (
    <Modal
      title="Tabs for this song"
      subtitle={`${song.name} — ${song.artistNames.join(', ')}`}
      onClose={onClose}
    >
      {linkedTabs.length > 0 && (
        <section className={styles.section} aria-label="On this song">
          <h3 className={styles.heading}>On this song</h3>
          <ul className={styles.list}>
            {linkedTabs.map((tab) => (
              <li key={tab.id} className={styles.row}>
                <button type="button" className={styles.name} onClick={() => onOpen(tab.id)}>
                  <span className={styles.tabName}>{tab.name}</span>
                  <span className={styles.meta}>{describeTab(tab)}</span>
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => onUnlink(tab.id)}
                  aria-label={`Remove ${tab.name} from this song`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-label="Library">
        <h3 className={styles.heading}>Add from your library</h3>
        <input
          className={styles.search}
          type="search"
          placeholder="Search your tabs…"
          aria-label="Search your tabs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {candidates.length > 0 ? (
          <ul className={styles.list}>
            {candidates.map((tab) => (
              <li key={tab.id} className={styles.row}>
                <span className={styles.name}>
                  <span className={styles.tabName}>{tab.name}</span>
                  <span className={styles.meta}>{describeTab(tab)}</span>
                </span>
                {onPreview && (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => onPreview(tab.id)}
                    aria-label={`Preview ${tab.name}`}
                  >
                    Preview
                  </button>
                )}
                <button
                  type="button"
                  className={styles.add}
                  onClick={() => onLink(tab.id)}
                  aria-label={`Add ${tab.name}`}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            {tabs.length === 0
              ? 'Your library is empty. Upload a Guitar Pro or Power Tab file to start it.'
              : query
                ? `No tabs match “${query}”.`
                : 'Every tab in your library is already on this song.'}
          </p>
        )}
      </section>

      {onlineSearch}

      <section className={styles.upload}>
        <FileButton label="Upload a new tab" accept={TAB_FILE_ACCEPT} onSelect={onUpload} />
        <p className={styles.hint}>
          .gp, .gp3–.gp5 and .gpx are drawn and played. .ptb files are kept, but must
          be converted (e.g. with TuxGuitar) before they can be shown.
        </p>
        {uploadError && (
          <p className={styles.error} role="alert">
            {uploadError}
          </p>
        )}
      </section>
    </Modal>
  )
}
