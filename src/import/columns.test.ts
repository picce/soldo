import type { Cell } from './types'
import { describe, expect, it } from 'vitest'
import { dateFormatOf, findLayout, guessMapping, isComplete, rowsOf, sampleOf, signatureOf } from './columns'
import { readCsv } from './csv'
import { fixtureBytes } from './fixtures/files'
import { decodeText } from './text'

function fixture(name: string): Cell[][] {
  return readCsv(decodeText(fixtureBytes(name)))
}

describe('a statement with Dare and Avere, a preamble and a total', () => {
  const table = fixture('banca-dare-avere.csv')
  const layout = findLayout(table)!

  it('finds the column names and the first row of data', () => {
    expect(layout.headerRow).toBe(3)
    expect(layout.dataStart).toBe(4)
    expect(layout.names).toEqual([
      'Data contabile',
      'Data valuta',
      'Dare',
      'Avere',
      'Descrizione',
      'Causale',
    ])
    expect(sampleOf(table, layout, 4)).toBe('PAGAMENTO POS ESSELUNGA MILANO 01/03 CARTA *1234')
  })

  it('proposes the booking date, the two amounts and both descriptions', () => {
    const mapping = guessMapping(table, layout)
    expect(mapping).toEqual({
      date: 0,
      description: 4,
      description2: 5,
      amount: { kind: 'split', debit: 2, credit: 3 },
    })
    expect(isComplete(mapping)).toBe(true)
    expect(dateFormatOf(table, layout, 0)).toBe('dmy')
  })

  it('reads the movements and leaves out the balance', () => {
    const mapping = guessMapping(table, layout)
    if (!isComplete(mapping))
      throw new Error('incomplete')
    const rows = rowsOf(table, layout, mapping, 'dmy')
    expect(rows.map(row => [row.date, row.amountCents])).toEqual([
      ['2026-03-02', -4590],
      ['2026-03-05', 185000],
      ['2026-03-07', -120],
      ['2026-03-07', -120],
      ['2026-03-10', -1299],
    ])
    expect(rows[2]!.description).toBe('PAGAMENTO POS BAR SPORT CAFFÈ Pagamento POS')
    expect(rows[0]!.line).toBe(5)
  })

  it('signs the file with its column names', () => {
    expect(signatureOf(layout)).toBe('data contabile|data valuta|dare|avere|descrizione|causale')
  })
})

describe('a statement with one signed amount and a balance', () => {
  const table = fixture('banca-importo.csv')
  const layout = findLayout(table)!

  it('takes the amount and not the balance', () => {
    expect(layout.headerRow).toBe(0)
    expect(guessMapping(table, layout)).toEqual({
      date: 0,
      description: 1,
      amount: { kind: 'single', column: 2 },
    })
  })
})

describe('a sheet without column names', () => {
  const table: Cell[][] = [
    ['01/03/2026', 'Bar Sport', '-1,20'],
    ['02/03/2026', 'Esselunga', '-45,90'],
    ['03/03/2026', 'Stipendio', '1.850,00'],
  ]

  it('guesses from what the columns hold', () => {
    const layout = findLayout(table)!
    expect(layout.headerRow).toBeNull()
    expect(signatureOf(layout)).toBe('#3')
    expect(guessMapping(table, layout)).toEqual({
      date: 0,
      description: 1,
      amount: { kind: 'single', column: 2 },
    })
  })

  it('splits two columns that share the rows, money out where the amounts are negative', () => {
    const split: Cell[][] = [
      ['01/03/2026', 'Bar', '', '-1,20'],
      [
        '02/03/2026',
        'Stipendio',
        '1.850,00',
        '',
      ],
      [
        '03/03/2026',
        'Esselunga',
        '',
        '-45,90',
      ],
    ]
    expect(guessMapping(split, findLayout(split)!).amount).toEqual({ kind: 'split', debit: 3, credit: 2 })
  })

  it('finds nothing in a table without dates', () => {
    expect(findLayout([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ])).toBeNull()
  })
})
