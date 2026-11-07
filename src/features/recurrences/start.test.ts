import type { Transaction } from '@/db/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { listCategories } from '@/db/repositories/categories'
import { seedDefaults } from '@/db/seed'
import { addedNotice } from './start'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
})

async function added(...notes: string[]): Promise<Transaction[]> {
  const [groceries] = await listCategories({ kind: 'expense' })
  return notes.map(note => ({ kind: 'expense', note, categoryId: groceries!.id }) as Transaction)
}

describe('addedNotice', () => {
  it('names what the series added, by note or else by category', async () => {
    expect(await addedNotice(await added('Affitto'))).toBe('Aggiunto dalle ricorrenze: Affitto')
    expect(await addedNotice(await added('Affitto', ''))).toBe('Aggiunti dalle ricorrenze: Affitto, Spesa')
  })

  it('counts them when they are many, or the same twice', async () => {
    expect(await addedNotice(await added('A', 'B', 'C', 'D'))).toBe('Aggiunti 4 movimenti dalle ricorrenze')
    expect(await addedNotice(await added('Caffè', 'Caffè'))).toBe('Aggiunti 2 movimenti dalle ricorrenze')
  })
})
