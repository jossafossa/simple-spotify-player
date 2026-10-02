/** Lower case, accents and punctuation stripped, words single-spaced. */
export const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** The URL slug most tab sites build from a name: "AC/DC" → "ac-dc". */
export const slugify = (text: string): string => normalise(text).replace(/ /g, '-')

const decodeEntity = (entity: string): string => {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

  if (entity.startsWith('#x')) {
    return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
  }

  if (entity.startsWith('#')) {
    return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
  }

  return named[entity] ?? `&${entity};`
}

export const decodeHtml = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_match, entity: string) => decodeEntity(entity))

/**
 * How well a found title matches the one asked for, from 0 to 1: the share
 * of the asked-for words it contains, docked for every extra word, so "Nemo"
 * beats "Nemo cover", which beats "Captain Nemo".
 */
export const titleScore = (wanted: string, found: string): number => {
  const wantedWords = normalise(wanted).split(' ').filter(Boolean)
  const foundWords = normalise(found).split(' ').filter(Boolean)

  if (wantedWords.length === 0 || foundWords.length === 0) {
    return 0
  }

  const matched = wantedWords.filter((word) => foundWords.includes(word)).length
  const extra = foundWords.filter((word) => !wantedWords.includes(word)).length

  return Math.max(matched / wantedWords.length - extra * 0.1, 0)
}

export const isSameArtist = (wanted: string, found: string): boolean => {
  const a = normalise(wanted).replace(/^the /, '')
  const b = normalise(found).replace(/^the /, '')
  return a !== '' && b !== '' && (a === b || a.includes(b) || b.includes(a))
}

/**
 * How much a result's artist counts against it: not at all when none was
 * asked for, a lot when it is someone else.
 */
export const artistFactor = (wanted: string, found: string): number => {
  if (!normalise(wanted)) {
    return 1
  }

  return isSameArtist(wanted, found) ? 1 : 0.4
}
