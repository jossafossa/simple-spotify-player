import { resetTabDatabaseConnection } from '~/lib/tabDatabase'

/** Gives a test an empty tab library, closing whatever connection is open. */
export const resetTabDatabase = async (): Promise<void> => {
  await resetTabDatabaseConnection()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('spotify-player')
    request.onsuccess = () => resolve()
    request.onblocked = () => resolve()
  })
}
