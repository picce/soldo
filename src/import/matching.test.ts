import { describe, expect, it } from 'vitest'
import { findPossibleDuplicates } from './duplicates'
import { externalIds } from './external-id'
import { matchRule, suggestKeyword } from './rules'

describe('externalIds', () => {
  const row = {
    line: 1,
    date: '2026-03-07',
    amountCents: -120,
    description: 'BAR  Sport',
  }

  it('gives the same id to the same movement in two files, whatever its line and spacing', async () => {
    const [first] = await externalIds([row])
    const [second] = await externalIds([
      { ...row, line: 40, description: 'bar sport' },
    ])
    expect(first).toMatch(/^imp1:[\da-f]{32}$/)
    expect(second).toBe(first)
  })

  it('keeps two equal movements of the same file apart', async () => {
    const ids = await externalIds([
      row,
      row,
      { ...row, amountCents: -150 },
    ])
    expect(new Set(ids).size).toBe(3)
    // The second equal row of the next file is the second one of this file.
    expect((await externalIds([row, row]))[1]).toBe(ids[1])
  })
})

describe('findPossibleDuplicates', () => {
  const candidates = [
    {
      id: 'coffee',
      kind: 'expense' as const,
      date: '2026-03-06',
      amountCents: 120,
    },
    {
      id: 'shop',
      kind: 'expense' as const,
      date: '2026-03-01',
      amountCents: 4590,
    },
    {
      id: 'salary',
      kind: 'income' as const,
      date: '2026-03-27',
      amountCents: 185000,
    },
  ]

  it('pairs same kind and amount within 3 days, the nearest first, each once', () => {
    const result = findPossibleDuplicates([
      { key: 'a', date: '2026-03-07', amountCents: -120 },
      { key: 'b', date: '2026-03-07', amountCents: -120 },
      { key: 'c', date: '2026-03-02', amountCents: -4590 },
      { key: 'd', date: '2026-03-05', amountCents: 185000 },
      { key: 'e', date: '2026-03-02', amountCents: 4590 },
    ], candidates)
    expect([...result]).toEqual([
      ['a', 'coffee'],
      ['c', 'shop'],
    ])
  })
})

describe('matchRule', () => {
  const rules = [
    { pattern: 'amazon', kind: 'expense' as const, categoryId: 'shopping' },
    { pattern: 'Amazon Prime', kind: 'expense' as const, categoryId: 'leisure' },
    { pattern: 'acme', kind: 'income' as const, categoryId: 'salary' },
  ]

  it('finds the keyword without case or accents, the longest winning', () => {
    expect(matchRule('PAGAMENTO AMAZON PRIME IT', 'expense', rules)?.categoryId).toBe('leisure')
    expect(matchRule('Amazon EU marketplace', 'expense', rules)?.categoryId).toBe('shopping')
  })

  it('looks only at the rules of the same kind', () => {
    expect(matchRule('Bonifico ACME SRL', 'expense', rules)).toBeUndefined()
    expect(matchRule('Bonifico ACME SRL', 'income', rules)?.categoryId).toBe('salary')
  })
})

describe('suggestKeyword', () => {
  it.each([
    ['PAGAMENTO POS ESSELUNGA MILANO 01/03 CARTA *1234', 'ESSELUNGA'],
    ['ADDEBITO SDD NETFLIX.COM', 'NETFLIX.COM'],
    ['PAGAMENTO POS BAR SPORT CAFFÈ', 'BAR SPORT'],
    ['BONIFICO A VOSTRO FAVORE DA ACME SRL STIPENDIO', 'ACME'],
    ['Bonifico istantaneo disposto a Mario Rossi', 'Mario'],
    ['Pagamento Apple Pay Ikea Corsico', 'Ikea'],
    ['123456 01/03/2026', ''],
  ])('proposes a keyword for %s', (description, keyword) => {
    expect(suggestKeyword(description)).toBe(keyword)
  })
})
