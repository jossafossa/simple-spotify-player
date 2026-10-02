import type { SongRef } from './types'

export type TabSearchLink = {
  site: string
  url: string
}

/**
 * Searches on tab sites, opened in a new tab. Neither site allows the app to
 * search them directly from the browser, so finding a file happens there and
 * the download comes back here as an upload.
 */
export const buildTabSearchLinks = (song: SongRef): TabSearchLink[] => {
  const query = [song.artistNames[0], song.name].filter(Boolean).join(' ')
  const encoded = encodeURIComponent(query)

  return [
    { site: 'Songsterr', url: `https://www.songsterr.com/?pattern=${encoded}` },
    {
      site: 'Ultimate Guitar',
      url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encoded}`,
    },
  ]
}
