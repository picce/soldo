import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeText } from './search'

describe('normalizeText', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(normalizeText('  Caffè   ALLA  Città ')).toBe('caffe alla citta')
  })
})

describe('matchesSearch', () => {
  it('finds every word in note or category', () => {
    expect(matchesSearch('esselunga', ['Esselunga, spesa della settimana', 'Spesa'])).toBe(true)
    expect(matchesSearch('caffe bar', ['Caffè al bar', 'Ristoranti'])).toBe(true)
    expect(matchesSearch('spesa pizza', ['Esselunga', 'Spesa'])).toBe(false)
  })

  it('matches everything with an empty query', () => {
    expect(matchesSearch('   ', ['qualsiasi'])).toBe(true)
  })
})
