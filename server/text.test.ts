import { describe, expect, it } from 'vitest'
import { artistFactor, decodeHtml, isSameArtist, normalise, slugify, titleScore } from './text.ts'

describe('text helpers', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise('  Beyoncé — Halo!  ')).toBe('beyonce halo')
    expect(normalise('Guns N’ Roses')).toBe('guns n roses')
  })

  it('slugs names the way tab sites do', () => {
    expect(slugify('AC/DC')).toBe('ac-dc')
    expect(slugify('Simon & Garfunkel')).toBe('simon-and-garfunkel')
  })

  it('decodes HTML entities', () => {
    expect(decodeHtml('Rock &amp; Roll &#39;n&#x27; &quot;more&quot;')).toBe(`Rock & Roll 'n' "more"`)
  })

  it('ranks an exact title above longer ones', () => {
    expect(titleScore('Nemo', 'Nemo')).toBe(1)
    expect(titleScore('Nemo', 'Nemo cover')).toBeCloseTo(0.9)
    expect(titleScore('Nemo', 'Amaranth')).toBe(0)
  })

  it('matches artists loosely, and does not penalise an empty one', () => {
    expect(isSameArtist('The Beatles', 'Beatles')).toBe(true)
    expect(isSameArtist('Nightwish', 'Epica')).toBe(false)
    expect(artistFactor('', 'Anyone')).toBe(1)
    expect(artistFactor('Nightwish', 'Epica')).toBe(0.4)
  })
})
