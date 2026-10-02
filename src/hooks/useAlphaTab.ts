import { useEffect, useRef, useState } from 'react'
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
  /** Moves the cursor to a moment in the song without playing it. */
  seekTo: (positionMs: number) => void
}

/** How close a reported seek must land to a requested one to count as it. */
const OWN_SEEK_TOLERANCE_MS = 100

type AlphaTabOptions = {
  /**
   * Called with the song time of a beat the user clicked in the score —
   * alphaTab moves its cursor there.
   */
  onBeatClick?: (timeMs: number) => void
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
  { onBeatClick }: AlphaTabOptions = {},
): UseAlphaTabResult => {
  // Only ever driven imperatively, never rendered, so a ref rather than state.
  const apiRef = useRef<AlphaTabApi | undefined>(undefined)
  const [loadedData, setLoadedData] = useState<ArrayBuffer>()
  const [status, setStatus] = useState<Exclude<AlphaTabStatus, 'idle' | 'loading'>>()
  const [title, setTitle] = useState<string>()
  const [tracks, setTracks] = useState<ScoreTrack[]>([])
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  // alphaTab only scrolls along while its own player plays; a cursor moved
  // from outside has to be followed by hand once the move lands.
  const isSeekingFromOutsideRef = useRef(false)
  // A click on a beat seeks the player; the next seek to somewhere other than
  // where this hook last sent it is the user's. Seeks from outside keep
  // coming several times a second, so one can land between click and seek.
  const isBeatClickRef = useRef(false)
  const lastOutsideTargetRef = useRef<number | undefined>(undefined)
  const onBeatClickRef = useRef(onBeatClick)

  useEffect(() => {
    onBeatClickRef.current = onBeatClick
  })

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
        instance.beatMouseDown.on(() => {
          isBeatClickRef.current = true
        })
        instance.playerPositionChanged.on((event) => {
          const isOwnSeek =
            lastOutsideTargetRef.current !== undefined &&
            Math.abs(event.currentTime - lastOutsideTargetRef.current) < OWN_SEEK_TOLERANCE_MS

          if (isBeatClickRef.current && event.isSeek && !isOwnSeek) {
            isBeatClickRef.current = false
            onBeatClickRef.current?.(event.currentTime)
            return
          }

          if (isSeekingFromOutsideRef.current) {
            isSeekingFromOutsideRef.current = false
            instance.scrollToCursor()
          }
        })

        // alphaTab reports a file it cannot parse through `error`, but the
        // return value catches the cases where it gives up before that.
        if (!instance.load(new Uint8Array(data))) {
          setStatus('error')
        }

        apiRef.current = instance
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
      apiRef.current = undefined
    }
  }, [container, scrollElement, data])

  const selectTrack = (index: number) => {
    const api = apiRef.current
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
      apiRef.current?.playPause()
    }
  }

  const stop = () => {
    apiRef.current?.stop()
  }

  const seekTo = (positionMs: number) => {
    const api = apiRef.current
    if (api && isPlayerReady) {
      isSeekingFromOutsideRef.current = true
      lastOutsideTargetRef.current = positionMs
      api.timePosition = positionMs
    }
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
    seekTo,
  }
}
