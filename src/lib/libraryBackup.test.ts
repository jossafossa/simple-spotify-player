import { describe, expect, it } from 'vitest'
import {
  buildLibraryBackup,
  InvalidBackupError,
  mergePinnedPlaylists,
  mergeSongs,
  mergeTabSettings,
  parseLibraryBackup,
} from './libraryBackup'
import type { TabFile } from './types'

const tab: TabFile = {
  id: 'tab-1',
  name: 'Nemo',
  fileName: 'Nemo.gp5',
  format: 'guitar-pro',
  sizeBytes: 3,
  addedAt: 1,
}
const song = { uri: 'spotify:track:nemo', name: 'Nemo', artistNames: ['Nightwish'], tabIds: ['tab-1'] }
const pin = { uri: 'spotify:playlist:mix', name: 'My Mix' }

const bytes = (...values: number[]) => new Uint8Array(values).buffer

describe('library backups', () => {
  it('round-trips tabs with their bytes, songs and pins', () => {
    const backup = buildLibraryBackup({
      tabs: [{ tab, data: bytes(0, 127, 255) }],
      songs: [song],
      pinnedPlaylists: [pin],
      tabSettings: { 'tab-1': { offsetMs: 1_500, trackIndex: 2 } },
    })

    const restored = parseLibraryBackup(JSON.stringify(backup))
    expect(restored.tabSettings).toEqual({ 'tab-1': { offsetMs: 1_500, trackIndex: 2 } })

    expect(restored.tabs).toHaveLength(1)
    expect(restored.tabs[0]!.tab).toEqual(tab)
    expect([...new Uint8Array(restored.tabs[0]!.data)]).toEqual([0, 127, 255])
    expect(restored.songs).toEqual([song])
    expect(restored.pinnedPlaylists).toEqual([pin])
  })

  it('survives files larger than one encoding chunk', () => {
    const large = new Uint8Array(100_000).map((_value, index) => index % 256)
    const backup = buildLibraryBackup({
      tabs: [{ tab, data: large.buffer }],
      songs: [],
      pinnedPlaylists: [],
      tabSettings: {},
    })

    const restored = parseLibraryBackup(JSON.stringify(backup))

    expect(new Uint8Array(restored.tabs[0]!.data)).toEqual(large)
  })

  it.each([
    ['not JSON', '{nope', /not JSON/],
    ['another app', JSON.stringify({ app: 'other' }), /not exported from this app/],
    [
      'a newer version',
      JSON.stringify({ app: 'simple-spotify-player', version: 2 }),
      /version 2/,
    ],
    [
      'damaged tabs',
      JSON.stringify({
        app: 'simple-spotify-player',
        version: 1,
        tabs: [{ id: 1 }],
        songs: [],
        pinnedPlaylists: [],
      }),
      /tabs are damaged/,
    ],
    [
      'damaged songs',
      JSON.stringify({
        app: 'simple-spotify-player',
        version: 1,
        tabs: [],
        songs: [{ uri: 'x' }],
        pinnedPlaylists: [],
      }),
      /songs are damaged/,
    ],
  ])('refuses %s', (_label, text, message) => {
    expect(() => parseLibraryBackup(text)).toThrow(InvalidBackupError)
    expect(() => parseLibraryBackup(text)).toThrow(message)
  })

  it('refuses file data that is not base64', () => {
    const text = JSON.stringify({
      app: 'simple-spotify-player',
      version: 1,
      tabs: [{ ...tab, dataBase64: '***' }],
      songs: [],
      pinnedPlaylists: [],
    })

    expect(() => parseLibraryBackup(text)).toThrow(/file for “Nemo” is damaged/)
  })
})

describe('tab settings in backups', () => {
  const backupWith = (extra: Record<string, unknown>) =>
    JSON.stringify({ app: 'simple-spotify-player', version: 1, tabs: [], songs: [], pinnedPlaylists: [], ...extra })

  it('reads a backup from before tab settings were saved', () => {
    expect(parseLibraryBackup(backupWith({})).tabSettings).toEqual({})
  })

  it('keeps well-formed settings and drops damaged ones without refusing the backup', () => {
    const restored = parseLibraryBackup(
      backupWith({ tabSettings: { a: { offsetMs: 500 }, b: { trackIndex: 'two' }, c: 'nope' } }),
    )

    expect(restored.tabSettings).toEqual({ a: { offsetMs: 500 } })
  })

  it('lets imported settings win per field', () => {
    expect(
      mergeTabSettings(
        { a: { offsetMs: 100, trackIndex: 1 }, b: { offsetMs: 9 } },
        { a: { offsetMs: 500 }, c: { trackIndex: 3 } },
      ),
    ).toEqual({ a: { offsetMs: 500, trackIndex: 1 }, b: { offsetMs: 9 }, c: { trackIndex: 3 } })
  })
})

describe('mergeSongs', () => {
  it('keeps the tabs a song already had alongside the imported ones', () => {
    const existing = [{ ...song, tabIds: ['tab-0', 'tab-1'] }]
    const imported = [song, { ...song, uri: 'spotify:track:new', tabIds: ['tab-9'] }]

    expect(mergeSongs(existing, imported)).toEqual([
      { ...song, tabIds: ['tab-0', 'tab-1'] },
      { ...song, uri: 'spotify:track:new', tabIds: ['tab-9'] },
    ])
  })
})

describe('mergePinnedPlaylists', () => {
  it('appends pins that are not there yet', () => {
    const other = { uri: 'spotify:playlist:other', name: 'Other' }

    expect(mergePinnedPlaylists([pin], [pin, other])).toEqual([pin, other])
  })
})
