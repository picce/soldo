import type { BackupErrorCode } from './provider'
import { readonly, ref, shallowRef } from 'vue'

/**
 * State of the automatic backup on this device (docs/specs/backup-google-drive.md). It lives
 * in localStorage, not in the database: it must not travel inside the backups, and writing
 * it must not count as a change that starts another backup. Light on purpose: main.ts loads
 * it with the first chunk.
 */

export interface BackupState {
  /** Google Drive is connected (the Worker holds the sign-in in a cookie). */
  connected: boolean
  /** Email address of the Google account. */
  account: string | null
  /** When the last backup reached Drive, ISO 8601. */
  lastBackupAt: string | null
  /** Checksum of the data of the last backup: unchanged data is not uploaded again. */
  lastChecksum: string | null
  /** Today's file, updated by the next backups of the day. */
  todayFile: { day: string, id: string } | null
  /** Why the last backup failed; 'offline' is not an error, the engine waits for the network. */
  error: Exclude<BackupErrorCode, 'offline'> | null
  /**
   * This device may write to Drive: it has backed up, restored from Drive, or the user chose
   * its data. Until then, if Drive already has backups, the engine asks before writing.
   */
  trusted: boolean
  /** Drive had backups when this device connected: nothing is written until the user picks. */
  choice: boolean
}

const STORAGE_KEY = 'soldo.backup'

export const DISCONNECTED: BackupState = {
  connected: false,
  account: null,
  lastBackupAt: null,
  lastChecksum: null,
  todayFile: null,
  error: null,
  trusted: false,
  choice: false,
}

function load(): BackupState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored
      ? {
          ...DISCONNECTED,
          ...JSON.parse(stored) as Partial<BackupState>,
        }
      : DISCONNECTED
  }
  catch {
    return DISCONNECTED
  }
}

const state = shallowRef<BackupState>(load())

/** Another tab (the installed app and the browser) changed the state: follow it. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY)
      state.value = load()
  })
}

export const backupState = readonly(state)

export function patchBackupState(patch: Partial<BackupState>): void {
  state.value = {
    ...state.value,
    ...patch,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
  }
  catch {
    // Storage full or blocked: the state lasts for this session.
  }
}

export function resetBackupState(): void {
  patchBackupState(DISCONNECTED)
}

/** A backup is running now. */
export const backupRunning = ref(false)
/** Changes not yet on Drive (e.g. made without network). */
export const backupPending = ref(false)
