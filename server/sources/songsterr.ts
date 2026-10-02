import { artistFactor, slugify, titleScore } from '../text.ts'
import type { OnlineTab, SourceSearch } from '../types.ts'

type SongsterrSong = {
  songId: number
  artist: string
  title: string
  tracks?: { instrument?: string }[]
}

const describeInstruments = (song: SongsterrSong): string => {
  const instruments = [...new Set((song.tracks ?? []).flatMap((track) => track.instrument ?? []))]
  return instruments.length > 0 ? `Songsterr · ${instruments.slice(0, 3).join(', ')}` : 'Songsterr'
}

/**
 * Songsterr's search is a public JSON endpoint, but its files are not: the
 * results are links to its own interactive player.
 */
export const searchSongsterr: SourceSearch = async ({ artist, title }, fetchPage) => {
  const pattern = encodeURIComponent(`${artist} ${title}`.trim())
  const songs = JSON.parse(
    await fetchPage(`https://www.songsterr.com/api/songs?pattern=${pattern}&size=10`),
  ) as SongsterrSong[]

  return songs.flatMap((song): OnlineTab[] => {
    const score = titleScore(title, song.title)
    if (score === 0) {
      return []
    }

    return [
      {
        id: `songsterr:${song.songId}`,
        source: 'songsterr',
        artist: song.artist,
        title: song.title,
        kind: describeInstruments(song),
        url: `https://www.songsterr.com/a/wsa/${slugify(song.artist)}-${slugify(song.title)}-tab-s${song.songId}`,
        downloadPath: undefined,
        rating: undefined,
        votes: undefined,
        relevance: score * artistFactor(artist, song.artist),
      },
    ]
  })
}
