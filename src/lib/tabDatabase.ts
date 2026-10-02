import type { TabFile, TabSong } from './types'

const DATABASE_NAME = 'spotify-player'
const DATABASE_VERSION = 1
const TABS = 'tabs'
/** File bytes live apart from their metadata so listing the library stays cheap. */
const TAB_DATA = 'tabData'
const SONGS = 'songs'

type TabDataRecord = {
  id: string
  data: ArrayBuffer
}

export type TabLibraryContents = {
  tabs: TabFile[]
  songs: TabSong[]
}

let databasePromise: Promise<IDBDatabase> | undefined

const openDatabase = (): Promise<IDBDatabase> => {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore(TABS, { keyPath: 'id' })
      database.createObjectStore(TAB_DATA, { keyPath: 'id' })
      database.createObjectStore(SONGS, { keyPath: 'uri' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      databasePromise = undefined
      reject(request.error)
    }
  })

  return databasePromise
}

/** Closes and forgets the connection, so tests can start from a fresh database. */
export const resetTabDatabaseConnection = async (): Promise<void> => {
  const pending = databasePromise
  databasePromise = undefined
  ;(await pending)?.close()
}

const asPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const completion = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })

export const readTabLibrary = async (): Promise<TabLibraryContents> => {
  const database = await openDatabase()
  const transaction = database.transaction([TABS, SONGS], 'readonly')
  const [tabs, songs] = await Promise.all([
    asPromise(transaction.objectStore(TABS).getAll() as IDBRequest<TabFile[]>),
    asPromise(transaction.objectStore(SONGS).getAll() as IDBRequest<TabSong[]>),
  ])

  return { tabs, songs }
}

export const readTabData = async (tabId: string): Promise<ArrayBuffer | undefined> => {
  const database = await openDatabase()
  const record = await asPromise(
    database.transaction(TAB_DATA, 'readonly').objectStore(TAB_DATA).get(tabId) as IDBRequest<
      TabDataRecord | undefined
    >,
  )

  return record?.data
}

export type TabWithData = {
  tab: TabFile
  data: ArrayBuffer
}

/** Writes tabs, file bytes and songs in one transaction, replacing same keys. */
export const writeTabLibrary = async ({
  tabs = [],
  songs = [],
}: {
  tabs?: TabWithData[]
  songs?: TabSong[]
}): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction([TABS, TAB_DATA, SONGS], 'readwrite')

  for (const { tab, data } of tabs) {
    transaction.objectStore(TABS).put(tab)
    transaction.objectStore(TAB_DATA).put({ id: tab.id, data } satisfies TabDataRecord)
  }

  for (const song of songs) {
    transaction.objectStore(SONGS).put(song)
  }

  await completion(transaction)
}

export const writeSong = (song: TabSong): Promise<void> => writeTabLibrary({ songs: [song] })

export const deleteSong = async (songUri: string): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction(SONGS, 'readwrite')
  transaction.objectStore(SONGS).delete(songUri)
  await completion(transaction)
}

/** Removes a tab and unlinks it from every song, dropping songs left without tabs. */
export const deleteTab = async (tabId: string): Promise<void> => {
  const database = await openDatabase()
  const transaction = database.transaction([TABS, TAB_DATA, SONGS], 'readwrite')
  const songStore = transaction.objectStore(SONGS)

  transaction.objectStore(TABS).delete(tabId)
  transaction.objectStore(TAB_DATA).delete(tabId)

  const songs = await asPromise(songStore.getAll() as IDBRequest<TabSong[]>)
  for (const song of songs) {
    if (!song.tabIds.includes(tabId)) {
      continue
    }

    const tabIds = song.tabIds.filter((id) => id !== tabId)
    if (tabIds.length === 0) {
      songStore.delete(song.uri)
    } else {
      songStore.put({ ...song, tabIds })
    }
  }

  await completion(transaction)
}
