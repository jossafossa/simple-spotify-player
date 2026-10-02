import { useEffect, useState } from 'react'
import type { AlphaTabApi } from '@coderline/alphatab'

export type AlphaTabStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ScoreTrack = {
  index: number
  name: string
}

export type UseAlphaTabResult = {
  status: AlphaTabStatus
  title: string | undefined
  tracks: ScoreTrack[]
  selectedTrackIndex: number
  selectTrack: (index: number) => void
  /** True once the sound font is in and the synthesizer can play. */
  isPlayerReady: boolean
  isPlaying: boolean
  playPause: () => void
  stop: () => void
}

type AlphaTabElements = {
  /** Where the notation is drawn. */
  container: HTMLElement | null
  /** The scrolling box around it, which the cursor keeps in view while playing. */
  scrollElement: HTMLElement | null
}

/**
 * Draws a Guitar Pro file with alphaTab and drives its synthesizer. alphaTab
 * is loaded only when a tab is first opened, so it costs nothing until then.
 */
export const useAlphaTab = (
  { container, scrollElement }: AlphaTabElements,
  data: ArrayBuffer | undefined,
): UseAlphaTabResult => {
  const [api, setApi] = useState<AlphaTabApi>()
  const [loadedData, setLoadedData] = useState<ArrayBuffer>()
  const [status, setStatus] = useState<Exclude<AlphaTabStatus, 'idle' | 'loading'>>()
  const [title, setTitle] = useState<string>()
  const [tracks, setTracks] = useState<ScoreTrack[]>([])
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // A new file starts from scratch, during render so the old score's tracks
  // and status never flash against it.
  if (data !== loadedData) {
    setLoadedData(data)
    setStatus(undefined)
    setTitle(undefined)
    setTracks([])
    setSelectedTrackIndex(0)
    setIsPlayerReady(false)
    setIsPlaying(false)
  }

  useEffect(() => {
    if (!container || !scrollElement || !data) {
      return
    }

    let isCancelled = false
    let created: AlphaTabApi | undefined

    import('@coderline/alphatab')
      .then((alphaTab) => {
        if (isCancelled) {
          return
        }

        const base = import.meta.env.BASE_URL
        created = new alphaTab.AlphaTabApi(container, {
          core: { fontDirectory: `${base}font/` },
          display: { scale: 0.9 },
          player: {
            playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
            soundFont: `${base}soundfont/sonivox.sf2`,
            scrollElement,
            enableCursor: true,
          },
        })
        const instance = created

        instance.scoreLoaded.on((score) => {
          setTitle(score.title || undefined)
          setTracks(score.tracks.map((track) => ({ index: track.index, name: track.name })))
          setSelectedTrackIndex(0)
        })
        instance.renderFinished.on(() => setStatus('ready'))
        instance.error.on((error) => {
          console.error('alphaTab could not show this tab', error)
          setStatus('error')
        })
        instance.playerReady.on(() => setIsPlayerReady(true))
        instance.playerStateChanged.on((event) => {
          setIsPlaying(event.state === alphaTab.synth.PlayerState.Playing)
        })

        // alphaTab reports a file it cannot parse through `error`, but the
        // return value catches the cases where it gives up before that.
        if (!instance.load(new Uint8Array(data))) {
          setStatus('error')
        }

        setApi(instance)
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          console.error('Could not load alphaTab', error)
          setStatus('error')
        }
      })

    return () => {
      isCancelled = true
      created?.destroy()
      setApi(undefined)
    }
  }, [container, scrollElement, data])

  const selectTrack = (index: number) => {
    const track = api?.score?.tracks[index]
    if (!api || !track) {
      return
    }

    api.stop()
    setSelectedTrackIndex(index)
    api.renderTracks([track])
  }

  const playPause = () => {
    if (isPlayerReady) {
      api?.playPause()
    }
  }

  const stop = () => {
    api?.stop()
  }

  return {
    status: !data ? 'idle' : (status ?? 'loading'),
    title,
    tracks,
    selectedTrackIndex,
    selectTrack,
    isPlayerReady,
    isPlaying,
    playPause,
    stop,
  }
}
