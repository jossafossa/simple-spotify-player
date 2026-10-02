import { cleanSongTitle } from './onlineTabSearch'
import type { SongRef } from './types'

const urisOf = (song: SongRef): string[] => [song.uri, ...(song.alternateUris ?? [])]

const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Title without release details, plus the first artist: what a song is. */
const identityOf = (song: SongRef): string =>
  `${normalise(cleanSongTitle(song.name))}|${normalise(song.artistNames[0] ?? '')}`

/**
 * Whether two references are the same song. The same URI settles it; failing
 * that, the same title and first artist do — Spotify plays a relinked copy,
 * or a remaster on another album, with a URI of its own.
 */
export const isSameSong = (a: SongRef, b: SongRef): boolean => {
  const bUris = urisOf(b)
  if (urisOf(a).some((uri) => bUris.includes(uri))) {
    return true
  }

  return identityOf(a) === identityOf(b)
}

/** The first of `candidates` that is the same song as `song`: by URI first, then by name. */
export const findSameSong = <T extends SongRef>(song: SongRef, candidates: T[]): T | undefined => {
  const uris = urisOf(song)
  return (
    candidates.find((candidate) => urisOf(candidate).some((uri) => uris.includes(uri))) ??
    candidates.find((candidate) => identityOf(candidate) === identityOf(song))
  )
}
