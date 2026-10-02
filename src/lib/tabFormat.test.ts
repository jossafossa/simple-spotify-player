import { describe, expect, it } from 'vitest'
import { detectTabFormat, isRenderableFormat, stripExtension, TAB_FILE_ACCEPT } from './tabFormat'

describe('detectTabFormat', () => {
  it('recognises every Guitar Pro version and Power Tab, ignoring case', () => {
    for (const name of ['a.gp3', 'a.gp4', 'a.GP5', 'a.gpx', 'a.gp']) {
      expect(detectTabFormat(name)).toBe('guitar-pro')
    }
    expect(detectTabFormat('Song.PTB')).toBe('power-tab')
  })

  it('rejects anything else', () => {
    expect(detectTabFormat('notes.txt')).toBeUndefined()
    expect(detectTabFormat('gp5')).toBeUndefined()
  })
})

describe('isRenderableFormat', () => {
  it('only draws Guitar Pro files', () => {
    expect(isRenderableFormat('guitar-pro')).toBe(true)
    expect(isRenderableFormat('power-tab')).toBe(false)
  })
})

describe('stripExtension', () => {
  it('drops the last extension but keeps dotted names and dotfiles', () => {
    expect(stripExtension('Nightwish - Nemo.gp5')).toBe('Nightwish - Nemo')
    expect(stripExtension('v1.2 solo.gpx')).toBe('v1.2 solo')
    expect(stripExtension('.gp5')).toBe('.gp5')
  })
})

it('offers every extension to the file picker', () => {
  expect(TAB_FILE_ACCEPT).toBe('.gp3,.gp4,.gp5,.gpx,.gp,.ptb')
})
