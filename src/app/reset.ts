import { ENCRYPTION_KEY } from '@/backup/encryption'
import { BACKUP_STATE_KEY } from '@/backup/state'
import { db } from '@/db/database'
import { ATTEMPTS_KEY, LOCK_KEY } from './lock'

/**
 * Erases everything Soldo keeps on this device (docs/specs/blocco-pin.md, "Cancellare i
 * dati"): the database, the state of the automatic backup, the encryption key and the lock.
 * The language stays. Then the app starts again from the welcome, where a backup restores.
 */
export async function eraseDeviceData(): Promise<void> {
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map(table => table.clear())))
  for (const key of [
    BACKUP_STATE_KEY,
    ENCRYPTION_KEY,
    LOCK_KEY,
    ATTEMPTS_KEY,
  ]) {
    try {
      localStorage.removeItem(key)
    }
    catch {
      // Blocked storage: nothing was kept there either.
    }
  }
  location.replace('/')
}
