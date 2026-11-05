import type { CsvOptions } from './csv'
import type { Transaction } from '@/db/schema'
import { describe, expect, it } from 'vitest'
import { BOM, transactionsToCsv } from './csv'

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
    deletedAt: null,
    kind: 'expense',
    amountCents: 1240,
    currency: 'EUR',
    date: '2026-11-05',
    accountId: 'cash',
    categoryId: 'groceries',
    note: '',
    source: 'manual',
    ...overrides,
  }
}

function options(locale: 'it' | 'en'): CsvOptions {
  return {
    locale,
    labels: {
      headers: [
        'Data',
        'Tipo',
        'Importo',
        'Categoria',
        'Conto',
        'Nota',
      ],
      kinds: { expense: 'Uscita', income: 'Entrata', transfer: 'Trasferimento' },
    },
    categoryName: item => item.categoryId === 'groceries'
      ? 'Spesa'
      : 'Stipendio',
    accountName: () => 'Contanti',
  }
}

function lines(csv: string) {
  return csv.replace(/^\uFEFF/, '').split('\r\n')
}

describe('transactionsToCsv', () => {
  it('writes Italian CSV with semicolons, decimal commas and signed amounts, oldest first', () => {
    const csv = transactionsToCsv([
      transaction({ date: '2026-11-05', note: 'Esselunga' }),
      transaction({
        date: '2026-11-01',
        kind: 'income',
        amountCents: 245000,
        categoryId: 'salary',
      }),
      transaction({ date: '2026-11-03', deletedAt: '2026-11-04T00:00:00.000Z' }),
    ], options('it'))

    expect(csv.startsWith(BOM)).toBe(true)
    expect(lines(csv)).toEqual([
      'Data;Tipo;Importo;Categoria;Conto;Nota',
      '2026-11-01;Entrata;2450,00;Stipendio;Contanti;',
      '2026-11-05;Uscita;-12,40;Spesa;Contanti;Esselunga',
      '',
    ])
  })

  it('writes English CSV with commas and decimal points', () => {
    const csv = transactionsToCsv([
      transaction({ amountCents: 5 }),
    ], options('en'))
    expect(lines(csv)[1]).toBe('2026-11-05,Uscita,-0.05,Spesa,Contanti,')
  })

  it('quotes separators, quotes and line breaks', () => {
    const csv = transactionsToCsv([
      transaction({ note: 'Pizza; birra' }),
      transaction({ note: 'Detto "basta"\ncena', createdAt: '2026-11-05T11:00:00.000Z' }),
    ], options('it'))
    expect(csv).toContain(';"Pizza; birra"\r\n')
    expect(csv).toContain(';"Detto ""basta""\ncena"\r\n')
    // A comma needs no quotes in the Italian file.
    expect(transactionsToCsv([
      transaction({ note: 'a, b' }),
    ], options('it'))).toContain(';a, b\r\n')
  })

  it('keeps notes from turning into spreadsheet formulas', () => {
    const csv = transactionsToCsv([
      transaction({ note: '=1+1' }),
    ], options('it'))
    expect(lines(csv)[1]).toBe('2026-11-05;Uscita;-12,40;Spesa;Contanti;\'=1+1')
  })
})
