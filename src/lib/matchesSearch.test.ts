import { describe, expect, it } from 'vitest'
import { matchesSearch } from './matchesSearch'

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSearch('  ', ['anything'])).toBe(true)
  })

  it('needs every word, in any of the texts, ignoring case and accents', () => {
    expect(matchesSearch('beyonce HALO', ['Halo', 'Beyoncé'])).toBe(true)
    expect(matchesSearch('halo crazy', ['Halo', 'Beyoncé'])).toBe(false)
  })
})
