import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyLocale } from '@/i18n/locale'
import { db } from '../database'
import { paymentMethodName } from '../names'
import { setClock } from '../records'
import { seedDefaults } from '../seed'
import { createAccount, getDefaultAccount } from './accounts'
import {
  archivePaymentMethod,
  countPaymentMethodTransactions,
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethod,
  LastPaymentMethodError,
  lastUsedPaymentMethod,
  listPaymentMethods,
  PaymentMethodInUseError,
  reorderPaymentMethods,
  restorePaymentMethod,
  startingPaymentMethod,
  unarchivePaymentMethod,
  updatePaymentMethod,
} from './payment-methods'
import { addTransaction, deleteTransaction, updateTransaction } from './transactions'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 6, 8, 0, tick++)))
  applyLocale('it')
  await seedDefaults()
})

afterEach(() => setClock())

async function byPreset(preset: string) {
  return (await listPaymentMethods()).find(method => method.preset === preset)!
}

async function spend(paymentMethodId: string | undefined, accountId?: string) {
  return addTransaction({
    kind: 'expense',
    amountCents: 100,
    date: '2026-11-06',
    accountId: accountId ?? (await getDefaultAccount())!.id,
    categoryId: 'groceries',
    note: '',
    paymentMethodId,
  })
}

describe('payment methods', () => {
  it('starts with the five defaults, in order, named in the app language', async () => {
    expect((await listPaymentMethods()).map(paymentMethodName)).toEqual([
      'Contanti',
      'Carta',
      'Satispay',
      'Bonifico',
      'Altro',
    ])
    applyLocale('en')
    expect((await listPaymentMethods()).map(paymentMethodName)).toEqual([
      'Cash',
      'Card',
      'Satispay',
      'Bank transfer',
      'Other',
    ])
  })

  it('creates a method at the end, and a default keeps its translation until renamed', async () => {
    const account = (await getDefaultAccount())!
    const created = await createPaymentMethod({ name: 'Carta aziendale', icon: 'credit-card', accountId: account.id })
    expect(created.order).toBe(5)
    const card = await byPreset('card')
    await updatePaymentMethod(card.id, { name: 'Carta' })
    expect((await getPaymentMethod(card.id))?.name).toBeUndefined()
    await updatePaymentMethod(card.id, { name: 'Bancomat' })
    expect((await getPaymentMethod(card.id))?.name).toBe('Bancomat')
  })

  it('saves the order', async () => {
    const ids = (await listPaymentMethods()).map(method => method.id).reverse()
    await reorderPaymentMethods(ids)
    expect((await listPaymentMethods()).map(method => method.id)).toEqual(ids)
  })

  it('archives and brings back, refusing the last active one', async () => {
    const methods = await listPaymentMethods()
    for (const method of methods.slice(1))
      await archivePaymentMethod(method.id)
    await expect(archivePaymentMethod(methods[0]!.id)).rejects.toThrow(LastPaymentMethodError)
    await expect(deletePaymentMethod(methods[0]!.id)).rejects.toThrow(LastPaymentMethodError)
    await unarchivePaymentMethod(methods[1]!.id)
    expect(await listPaymentMethods()).toHaveLength(2)
  })

  it('refuses to delete a used method, and restores a deleted one', async () => {
    const card = await byPreset('card')
    const expense = await spend(card.id)
    expect(await countPaymentMethodTransactions(card.id)).toBe(1)
    await expect(deletePaymentMethod(card.id)).rejects.toThrow(PaymentMethodInUseError)
    await deleteTransaction(expense.id)
    await deletePaymentMethod(card.id)
    expect(await getPaymentMethod(card.id)).toBeUndefined()
    await restorePaymentMethod(card.id)
    expect(await getPaymentMethod(card.id)).toBeDefined()
  })

  it('leaves saved expenses on their account when a method moves', async () => {
    const cash = (await getDefaultAccount())!
    const bank = await createAccount({
      name: 'Banca',
      icon: 'bank',
      color: 7,
      initialBalanceCents: 0,
    })
    const card = await byPreset('card')
    const expense = await spend(card.id, cash.id)
    await updatePaymentMethod(card.id, { accountId: bank.id })
    expect((await db.transactions.get(expense.id))?.accountId).toBe(cash.id)
  })

  describe('last used', () => {
    it('is none before any expense with a method', async () => {
      await spend(undefined)
      expect(await lastUsedPaymentMethod()).toBeUndefined()
    })

    it('follows the latest change, editing included', async () => {
      const card = await byPreset('card')
      const satispay = await byPreset('satispay')
      const old = await spend(card.id)
      await spend(satispay.id)
      expect((await lastUsedPaymentMethod())?.id).toBe(satispay.id)
      await updateTransaction(old.id, { note: 'Esselunga' })
      expect((await lastUsedPaymentMethod())?.id).toBe(card.id)
    })

    it('skips deleted expenses and archived methods', async () => {
      const card = await byPreset('card')
      const satispay = await byPreset('satispay')
      const bonifico = await byPreset('bankTransfer')
      await spend(card.id)
      const removed = await spend(satispay.id)
      await deleteTransaction(removed.id)
      expect((await lastUsedPaymentMethod())?.id).toBe(card.id)
      await spend(bonifico.id)
      await archivePaymentMethod(bonifico.id)
      expect((await lastUsedPaymentMethod())?.id).toBe(card.id)
    })

    it('can look only among the methods of an account', async () => {
      const bank = await createAccount({
        name: 'Banca',
        icon: 'bank',
        color: 7,
        initialBalanceCents: 0,
      })
      const card = await byPreset('card')
      await updatePaymentMethod(card.id, { accountId: bank.id })
      const cash = await byPreset('cash')
      await spend(card.id, bank.id)
      await spend(cash.id)
      expect((await lastUsedPaymentMethod())?.id).toBe(cash.id)
      expect((await lastUsedPaymentMethod(bank.id))?.id).toBe(card.id)
    })
  })

  describe('starting method', () => {
    it('is the first of the list before any use', async () => {
      expect((await startingPaymentMethod())?.preset).toBe('cash')
    })

    it('prefers the chosen account, then the last used of all', async () => {
      const bank = await createAccount({
        name: 'Banca',
        icon: 'bank',
        color: 7,
        initialBalanceCents: 0,
      })
      const other = await createAccount({
        name: 'Altro',
        icon: 'coins',
        color: 2,
        initialBalanceCents: 0,
      })
      const card = await byPreset('card')
      await updatePaymentMethod(card.id, { accountId: bank.id })
      const satispay = await byPreset('satispay')
      await spend(card.id, bank.id)
      await spend(satispay.id)
      expect((await startingPaymentMethod(bank.id))?.id).toBe(card.id)
      expect((await startingPaymentMethod(other.id))?.id).toBe(satispay.id)
      expect((await startingPaymentMethod())?.id).toBe(satispay.id)
    })
  })
})
