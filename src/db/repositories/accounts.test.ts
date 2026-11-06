import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyLocale } from '@/i18n/locale'
import { db } from '../database'
import { accountName } from '../names'
import { setClock } from '../records'
import { seedDefaults } from '../seed'
import {
  AccountInUseError,
  archiveAccount,
  countAccountTransactions,
  createAccount,
  deleteAccount,
  getAccount,
  getDefaultAccount,
  LastAccountError,
  listAccounts,
  reorderAccounts,
  restoreAccount,
  unarchiveAccount,
  updateAccount,
} from './accounts'
import { listPaymentMethods, updatePaymentMethod } from './payment-methods'
import { addTransaction, deleteTransaction } from './transactions'

let tick = 0

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  tick = 0
  setClock(() => new Date(Date.UTC(2026, 10, 6, 8, 0, tick++)))
  applyLocale('it')
  await seedDefaults()
})

afterEach(() => setClock())

const BANK = {
  name: 'Banca',
  icon: 'bank',
  color: 7,
  initialBalanceCents: 120000,
} as const

describe('accounts', () => {
  it('creates an account at the end of the list, with the type its icon says', async () => {
    const created = await createAccount(BANK)
    expect(created).toMatchObject({
      name: 'Banca',
      type: 'bank',
      currency: 'EUR',
      order: 1,
      archived: false,
    })
    expect((await listAccounts()).map(accountName)).toEqual(['Contanti', 'Banca'])
  })

  it('accepts a negative initial balance and refuses a broken one or a bad name', async () => {
    expect((await createAccount({ ...BANK, initialBalanceCents: -5000 })).initialBalanceCents).toBe(-5000)
    await expect(createAccount({ ...BANK, initialBalanceCents: 1.5 })).rejects.toThrow(RangeError)
    await expect(createAccount({ ...BANK, name: '   ' })).rejects.toThrow(RangeError)
    await expect(createAccount({
      ...BANK,
      name: 'x'.repeat(25),
    })).rejects.toThrow(RangeError)
  })

  it('keeps «Contanti» following the language until its name changes', async () => {
    const cash = (await getDefaultAccount())!
    await updateAccount(cash.id, { name: 'Contanti' })
    expect((await getAccount(cash.id))?.name).toBeUndefined()
    applyLocale('en')
    expect(accountName((await getAccount(cash.id))!)).toBe('Cash')
    applyLocale('it')
    await updateAccount(cash.id, { name: 'Portafoglio' })
    expect((await getAccount(cash.id))?.name).toBe('Portafoglio')
  })

  it('updates the type together with the icon', async () => {
    const bank = await createAccount(BANK)
    await updateAccount(bank.id, { icon: 'credit-card', initialBalanceCents: -1 })
    expect(await getAccount(bank.id)).toMatchObject({ icon: 'credit-card', type: 'card', initialBalanceCents: -1 })
  })

  it('makes the first of the list the default one', async () => {
    const cash = (await getDefaultAccount())!
    const bank = await createAccount(BANK)
    await reorderAccounts([bank.id, cash.id])
    expect((await getDefaultAccount())?.id).toBe(bank.id)
  })

  describe('archiving', () => {
    it('hides the account unless asked for, and brings it back at the end', async () => {
      const bank = await createAccount(BANK)
      await archiveAccount(bank.id)
      expect((await listAccounts()).map(account => account.id)).not.toContain(bank.id)
      expect((await listAccounts({ includeArchived: true })).map(account => account.id)).toContain(bank.id)
      await unarchiveAccount(bank.id)
      expect(await getAccount(bank.id)).toMatchObject({ archived: false, order: 2 })
    })

    it('refuses the last active account', async () => {
      const cash = (await getDefaultAccount())!
      await expect(archiveAccount(cash.id)).rejects.toThrow(LastAccountError)
      const bank = await createAccount(BANK)
      await archiveAccount(bank.id)
      await expect(archiveAccount(cash.id)).rejects.toThrow(LastAccountError)
    })

    it('moves its payment methods to the default account, and «Annulla» brings them back', async () => {
      const cash = (await getDefaultAccount())!
      const bank = await createAccount(BANK)
      const [first, second] = await listPaymentMethods()
      await updatePaymentMethod(first!.id, { accountId: bank.id })
      await updatePaymentMethod(second!.id, { accountId: bank.id })

      const moved = await archiveAccount(bank.id)
      expect(moved.sort()).toEqual([first!.id, second!.id].sort())
      expect(new Set((await listPaymentMethods()).map(method => method.accountId))).toEqual(new Set([cash.id]))

      await unarchiveAccount(bank.id, { order: bank.order, methodIds: moved })
      expect((await listPaymentMethods()).filter(method => method.accountId === bank.id)).toHaveLength(2)
      expect((await getAccount(bank.id))?.order).toBe(bank.order)
    })
  })

  describe('deleting', () => {
    const transfer = (accountId: string, toAccountId: string) => addTransaction({
      kind: 'transfer',
      amountCents: 100,
      date: '2026-11-06',
      accountId,
      toAccountId,
      categoryId: null,
      note: '',
    })

    it('counts transfers towards the account as uses', async () => {
      const cash = (await getDefaultAccount())!
      const bank = await createAccount(BANK)
      const sent = await transfer(cash.id, bank.id)
      expect(await countAccountTransactions(bank.id)).toBe(1)
      await expect(deleteAccount(bank.id)).rejects.toThrow(AccountInUseError)
      await deleteTransaction(sent.id)
      expect(await countAccountTransactions(bank.id)).toBe(0)
    })

    it('deletes an unused account, and «Annulla» restores it with its methods', async () => {
      const bank = await createAccount(BANK)
      const [first] = await listPaymentMethods()
      await updatePaymentMethod(first!.id, { accountId: bank.id })

      const moved = await deleteAccount(bank.id)
      expect(await getAccount(bank.id)).toBeUndefined()
      expect((await listPaymentMethods()).find(method => method.id === first!.id)?.accountId).not.toBe(bank.id)

      await restoreAccount(bank.id, moved)
      expect((await getAccount(bank.id))?.id).toBe(bank.id)
      expect((await listPaymentMethods()).find(method => method.id === first!.id)?.accountId).toBe(bank.id)
    })

    it('refuses the last active account', async () => {
      await expect(deleteAccount((await getDefaultAccount())!.id)).rejects.toThrow(LastAccountError)
    })
  })
})
