const normalise = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * True when every word of the query appears somewhere in the texts, ignoring
 * case and accents — so "beyonce halo" finds "Halo" by "Beyoncé".
 */
export const matchesSearch = (query: string, texts: string[]): boolean => {
  const words = normalise(query).split(/\s+/).filter(Boolean)
  const haystack = normalise(texts.join(' '))

  return words.every((word) => haystack.includes(word))
}
