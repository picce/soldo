import type { Transaction } from '@/db/schema'
import { describe, expect, it } from 'vitest'
import { accountBalances } from './balances'

const ACCOUNTS = [
  { id: 'bank', initialBalanceCents: 100000 },
  { id: 'cash', initialBalanceCents: -500 },
]
const TODAY = '2026-11-06'

function row(overrides: Partial<Transaction>) {
  return {
    kind: 'expense',
    amountCents: 1000,
    date: TODAY,
    accountId: 'bank',
    deletedAt: null,
    ...overrides,
  } as Transaction
}

describe('accountBalances', () => {
  it('starts from the initial balance, negative too', () => {
    const balances = accountBalances(ACCOUNTS, [], TODAY)
    expect(balances.get('bank')).toBe(100000)
    expect(balances.get('cash')).toBe(-500)
  })

  it('adds income and takes off expenses', () => {
    const balances = accountBalances(ACCOUNTS, [
      row({ kind: 'income', amountCents: 2500 }),
      row({ amountCents: 1000 }),
    ], TODAY)
    expect(balances.get('bank')).toBe(101500)
    expect(balances.get('cash')).toBe(-500)
  })

  it('moves a transfer from one account to the other', () => {
    const balances = accountBalances(ACCOUNTS, [
      row({ kind: 'transfer', amountCents: 2000, toAccountId: 'cash' }),
    ], TODAY)
    expect(balances.get('bank')).toBe(98000)
    expect(balances.get('cash')).toBe(1500)
  })

  it('leaves out deleted transactions, and future ones until their day', () => {
    const balances = accountBalances(ACCOUNTS, [
      row({ deletedAt: '2026-11-06T10:00:00.000Z' }),
      row({ date: '2026-11-07' }),
    ], TODAY)
    expect(balances.get('bank')).toBe(100000)
    expect(accountBalances(ACCOUNTS, [
      row({ date: '2026-11-07' }),
    ], '2026-11-07').get('bank')).toBe(99000)
  })

  it('ignores transactions of accounts not asked for', () => {
    const balances = accountBalances(ACCOUNTS, [
      row({ accountId: 'gone' }),
    ], TODAY)
    expect(balances.has('gone')).toBe(false)
    expect(balances.get('bank')).toBe(100000)
  })
})
