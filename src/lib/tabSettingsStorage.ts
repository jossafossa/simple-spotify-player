import { MAX_BPM, MIN_BPM } from './tempo'

/** How one tab was last viewed, remembered per tab in this browser. */
export type TabSettings = {
  /** How far the tab's timeline sits from the recording's, for sync. */
  offsetMs?: number
  /** Which of the file's instrument tracks is shown. */
  trackIndex?: number
  /** The recording's tempo, when it differs from the one the tab is written in. */
  bpm?: number
}

const SETTINGS_KEY = 'spotify-player:tab-settings'
/** Where offsets lived before the instrument track was remembered too. */
const LEGACY_OFFSETS_KEY = 'spotify-player:tab-sync-offsets'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const parseSettings = (value: unknown): TabSettings | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const { offsetMs, trackIndex, bpm } = value as Record<string, unknown>
  const settings: TabSettings = {}
  if (isFiniteNumber(offsetMs) && offsetMs !== 0) {
    settings.offsetMs = offsetMs
  }
  if (isFiniteNumber(trackIndex) && Number.isInteger(trackIndex) && trackIndex > 0) {
    settings.trackIndex = trackIndex
  }
  if (isFiniteNumber(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM) {
    settings.bpm = bpm
  }

  return Object.keys(settings).length > 0 ? settings : undefined
}

/** Keeps only well-formed entries, so a damaged store or backup is ignored, not trusted. */
export const parseAllTabSettings = (value: unknown): Record<string, TabSettings> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([tabId, entry]) => {
      const settings = parseSettings(entry)
      return settings ? [[tabId, settings]] : []
    }),
  )
}

const readJson = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export const readAllTabSettings = (): Record<string, TabSettings> => {
  const legacy = readJson(LEGACY_OFFSETS_KEY)
  const fromLegacy =
    typeof legacy === 'object' && legacy !== null
      ? parseAllTabSettings(
          Object.fromEntries(
            Object.entries(legacy).map(([tabId, offsetMs]) => [tabId, { offsetMs }]),
          ),
        )
      : {}
  const current = parseAllTabSettings(readJson(SETTINGS_KEY))

  const merged: Record<string, TabSettings> = { ...fromLegacy }
  for (const [tabId, settings] of Object.entries(current)) {
    merged[tabId] = { ...merged[tabId], ...settings }
  }
  return merged
}

export const writeAllTabSettings = (settings: Record<string, TabSettings>): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parseAllTabSettings(settings)))
    localStorage.removeItem(LEGACY_OFFSETS_KEY)
  } catch {
    // The settings are only lost for the next visit.
  }
}

export const readTabSettings = (tabId: string): TabSettings => readAllTabSettings()[tabId] ?? {}

export const saveTabSettings = (tabId: string, changes: TabSettings): void => {
  const all = readAllTabSettings()
  all[tabId] = { ...all[tabId], ...changes }
  writeAllTabSettings(all)
}

export const deleteTabSettings = (tabId: string): void => {
  const all = readAllTabSettings()
  delete all[tabId]
  writeAllTabSettings(all)
}
