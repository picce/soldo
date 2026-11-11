import { describe, expect, it } from 'vitest'
import { frequentNotes } from './notes'

// Newest first, as the repository reads them.
const NOTES = [
  'Bar',
  'Esselunga',
  'esselunga',
  'Caffè',
  'Benzina',
  'ESSELUNGA',
  'caffe',
  'Bar',
  '  ',
]

describe('frequentNotes', () => {
  it('puts the most used first, then the most recent, as last written', () => {
    expect(frequentNotes(NOTES)).toEqual(['Esselunga', 'Bar', 'Caffè', 'Benzina'])
  })

  it('keeps the notes that hold what is typed, ignoring case and accents', () => {
    expect(frequentNotes(NOTES, 'caf')).toEqual(['Caffè'])
    expect(frequentNotes(NOTES, 'E')).toEqual(['Esselunga', 'Caffè', 'Benzina'])
    expect(frequentNotes(NOTES, 'pizza')).toEqual([])
  })

  it('does not suggest what is already written', () => {
    expect(frequentNotes(NOTES, 'bar')).toEqual([])
    expect(frequentNotes(NOTES, 'caffè')).toEqual([])
  })

  it('stops at the limit', () => {
    expect(frequentNotes(NOTES, '', 2)).toEqual(['Esselunga', 'Bar'])
  })
})
