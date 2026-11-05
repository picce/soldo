import type { MetaKey } from '../schema'
import { db } from '../database'

export async function getMeta<T>(key: MetaKey): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: MetaKey, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
