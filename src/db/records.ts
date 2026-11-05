import type { BaseRecord } from './schema'

let clock: () => Date = () => new Date()

/** Replaces the clock used for timestamps; tests only. Call without arguments to restore it. */
export function setClock(next?: () => Date) {
  clock = next ?? (() => new Date())
}

/** Current timestamp, ISO 8601. */
export function now(): string {
  return clock().toISOString()
}

/** Id and timestamps of a new record. */
export function newRecord(): BaseRecord {
  const timestamp = now()
  return {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
}
