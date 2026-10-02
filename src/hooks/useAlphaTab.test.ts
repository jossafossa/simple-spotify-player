import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAlphaTab } from './useAlphaTab'

type Handler = (payload?: unknown) => void

const emitter = () => {
  const handlers: Handler[] = []
  return {
    on: (handler: Handler) => handlers.push(handler),
    emit: (payload?: unknown) => handlers.forEach((handler) => handler(payload)),
  }
}

class FakeAlphaTabApi {
  static instances: FakeAlphaTabApi[] = []
  static loadResult = true

  scoreLoaded = emitter()
  renderFinished = emitter()
  error = emitter()
  playerReady = emitter()
  playerStateChanged = emitter()
  score = { tracks: [{ index: 0 }, { index: 1 }] }
  load = vi.fn(() => FakeAlphaTabApi.loadResult)
  renderTracks = vi.fn()
  playPause = vi.fn()
  stop = vi.fn()
  destroy = vi.fn()

  element: HTMLElement
  settings: Record<string, Record<string, unknown>>

  constructor(element: HTMLElement, settings: Record<string, Record<string, unknown>>) {
    this.element = element
    this.settings = settings
    FakeAlphaTabApi.instances.push(this)
  }
}

vi.mock('@coderline/alphatab', () => ({
  AlphaTabApi: FakeAlphaTabApi,
  PlayerMode: { EnabledSynthesizer: 2 },
  synth: { PlayerState: { Paused: 0, Playing: 1 } },
}))

const elements = () => ({
  container: document.createElement('div'),
  scrollElement: document.createElement('div'),
})

const data = new Uint8Array([1, 2]).buffer

const renderReady = async () => {
  const view = renderHook(({ input }) => useAlphaTab(input.elements, input.data), {
    initialProps: { input: { elements: elements(), data: data as ArrayBuffer | undefined } },
  })
  await waitFor(() => expect(FakeAlphaTabApi.instances).toHaveLength(1))
  const api = FakeAlphaTabApi.instances[0]!

  act(() => {
    api.scoreLoaded.emit({
      title: 'Nemo',
      tracks: [
        { index: 0, name: 'Guitar' },
        { index: 1, name: 'Bass' },
      ],
    })
    api.renderFinished.emit()
  })

  return { ...view, api }
}

describe('useAlphaTab', () => {
  beforeEach(() => {
    FakeAlphaTabApi.instances = []
    FakeAlphaTabApi.loadResult = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('stays idle without a file', () => {
    const { result } = renderHook(() => useAlphaTab(elements(), undefined))

    expect(result.current.status).toBe('idle')
    expect(FakeAlphaTabApi.instances).toHaveLength(0)
  })

  it('loads the file with the synthesizer and the copied font and sound font', async () => {
    const { result, api } = await renderReady()

    expect(api.load).toHaveBeenCalledWith(new Uint8Array([1, 2]))
    expect(api.settings.player).toMatchObject({
      playerMode: 2,
      soundFont: '/soundfont/sonivox.sf2',
      enableCursor: true,
    })
    expect(api.settings.core).toEqual({ fontDirectory: '/font/' })
    expect(result.current.status).toBe('ready')
    expect(result.current.title).toBe('Nemo')
    expect(result.current.tracks).toEqual([
      { index: 0, name: 'Guitar' },
      { index: 1, name: 'Bass' },
    ])
  })

  it('switches track, stopping playback first', async () => {
    const { result, api } = await renderReady()

    act(() => result.current.selectTrack(1))

    expect(api.stop).toHaveBeenCalled()
    expect(api.renderTracks).toHaveBeenCalledWith([api.score.tracks[1]])
    expect(result.current.selectedTrackIndex).toBe(1)
  })

  it('only plays once the synthesizer is ready, and follows its state', async () => {
    const { result, api } = await renderReady()

    act(() => result.current.playPause())
    expect(api.playPause).not.toHaveBeenCalled()

    act(() => api.playerReady.emit())
    act(() => result.current.playPause())
    expect(api.playPause).toHaveBeenCalledOnce()

    act(() => api.playerStateChanged.emit({ state: 1 }))
    expect(result.current.isPlaying).toBe(true)
  })

  it('reports a file alphaTab cannot read', async () => {
    const { result, api } = await renderReady()

    act(() => api.error.emit(new Error('bad file')))

    expect(result.current.status).toBe('error')
  })

  it('reports a file alphaTab refuses to load', async () => {
    FakeAlphaTabApi.loadResult = false
    const { result } = renderHook(() => useAlphaTab(elements(), data))

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('tears alphaTab down when the file changes', async () => {
    const { rerender, api, result } = await renderReady()

    rerender({ input: { elements: elements(), data: new Uint8Array([3]).buffer } })

    expect(api.destroy).toHaveBeenCalled()
    expect(result.current.status).toBe('loading')
    expect(result.current.tracks).toEqual([])
    await waitFor(() => expect(FakeAlphaTabApi.instances).toHaveLength(2))
  })
})
