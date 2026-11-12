import type { Transaction } from '@/db/schema'
import { describe, expect, it } from 'vitest'
import { buildPreview, countPreview, recategorize, toPlan, withRule } from './preview'

const rows = [
  {
    line: 1,
    date: '2026-03-02',
    amountCents: -4590,
    description: 'POS ESSELUNGA MILANO',
  },
  {
    line: 2,
    date: '2026-03-05',
    amountCents: 185000,
    description: 'ACME SRL',
  },
  {
    line: 3,
    date: '2026-03-07',
    amountCents: -120,
    description: 'BAR SPORT',
  },
  {
    line: 4,
    date: '2026-03-10',
    amountCents: -1299,
    description: 'NETFLIX.COM',
  },
]
const ids = ['a', 'b', 'c', 'd']
const fallbacks = { expense: 'other', income: 'otherIncome' }
const typed = {
  id: 'coffee',
  kind: 'expense',
  amountCents: 120,
  date: '2026-03-06',
  note: 'Caffè',
} as Transaction

function preview() {
  return buildPreview({
    rows,
    ids,
    imported: new Set(['d']),
    duplicates: new Map([
      ['c', typed],
    ]),
    rules: [
      { pattern: 'esselunga', kind: 'expense', categoryId: 'groceries' },
    ],
    fallbacks,
  })
}

describe('buildPreview', () => {
  it('leaves out what was imported, newest first, with categories from the rules', () => {
    const result = preview()
    expect(result.importedCount).toBe(1)
    expect(result.rows.map(row => [
      row.key,
      row.kind,
      row.categoryId,
      row.merge,
    ])).toEqual([
      ['c', 'expense', 'other', true],
      ['b', 'income', 'otherIncome', false],
      ['a', 'expense', 'groceries', false],
    ])
    expect(countPreview(result.rows)).toEqual({ add: 2, merge: 1 })
  })
})

describe('rules in the preview', () => {
  it('a new rule changes the rows not chosen by hand', () => {
    const { rows: previewRows } = preview()
    const chosen = previewRows.map(row => row.key === 'b'
      ? { ...row, manual: true, categoryId: 'refunds' }
      : row)
    const rules = withRule([], { pattern: 'acme', kind: 'income', categoryId: 'salary' })
    const again = recategorize(chosen, withRule(rules, { pattern: 'BAR', kind: 'expense', categoryId: 'restaurants' }), fallbacks)
    expect(again.map(row => row.categoryId)).toEqual(['restaurants', 'refunds', 'other'])
  })

  it('keeps one rule per keyword and kind', () => {
    const rules = withRule([
      { pattern: 'Bar', kind: 'expense', categoryId: 'a' },
    ], { pattern: 'bar', kind: 'expense', categoryId: 'b' })
    expect(rules).toEqual([
      { pattern: 'bar', kind: 'expense', categoryId: 'b' },
    ])
  })
})

describe('toPlan', () => {
  it('adds, merges and leaves out as chosen', () => {
    const { rows: previewRows } = preview()
    const chosen = previewRows.map(row => row.key === 'a'
      ? { ...row, include: false }
      : row)
    const preset = {
      signature: 's',
      mapping: {
        date: 0,
        description: 1,
        amount: { kind: 'single' as const, column: 2 },
      },
      dateFormat: 'dmy' as const,
    }
    expect(toPlan('bank', chosen, [], preset)).toEqual({
      accountId: 'bank',
      add: [
        {
          externalId: 'b',
          date: '2026-03-05',
          amountCents: 185000,
          note: 'ACME SRL',
          categoryId: 'otherIncome',
        },
      ],
      merge: [
        { transactionId: 'coffee', externalId: 'c' },
      ],
      rules: [],
      preset,
    })
    const unmerged = previewRows.map(row => row.key === 'c'
      ? { ...row, merge: false }
      : row)
    expect(toPlan('bank', unmerged, []).add.map(row => row.externalId)).toEqual(['c', 'b', 'a'])
  })
})
