import type { ObservabilitySet } from 'dexie'
import type { ServiceId } from './oauth'
import type { BackupErrorCode, BackupProvider, RemoteBackup } from './provider'
import Dexie from 'dexie'
import { db } from '@/db/database'
import { getMeta } from '@/db/repositories/meta'
import { today } from '@/domain/dates'
import { dropbox } from './dropbox/dropbox'
import { createBackup } from './export'
import { googleDrive } from './google/drive'
import { onedrive } from './onedrive/onedrive'
import { checksumOf, sealBackup, summarize } from './pack'
import { errorCode } from './provider'
import { backupsToRemove } from './retention'
import { serviceAuths } from './services'
import { backupPending, backupRunning, backupState, patchBackupState, resetBackupState } from './state'

/**
 * The automatic backup (docs/specs/backup-google-drive.md, "Motore"): after the changes,
 * at start, when the app goes to the background and when the network comes back, a
 * snapshot of the database goes to Drive, unless it is the same as the last one.
 */

/** Quiet time after the last change: a burst of changes makes one backup. */
export const CHANGE_DELAY = 10_000
/** After start, so the first screen is drawn first. */
export const START_DELAY = 3_000
const LOCK_NAME = 'soldo-backup'

/**
 * How a run ended: uploaded, nothing changed, not run (not connected, waiting for the
 * user's choice, before the first start, or another run in progress), Drive already had
 * backups (the choice is now asked), or why it failed.
 */
export type BackupOutcome = 'uploaded' | 'unchanged' | 'skipped' | 'choice' | BackupErrorCode

const PROVIDERS: Record<ServiceId, BackupProvider> = {
  google: googleDrive,
  dropbox,
  onedrive,
}

let override: BackupProvider | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let started = false

/** Another destination for the backups; tests only. Without arguments, the real ones again. */
export function setBackupProvider(next?: BackupProvider): void {
  override = next
}

/** Where the backups go: the service connected (Google Drive, Dropbox or OneDrive). */
export function backupProvider(): BackupProvider {
  return override ?? PROVIDERS[backupState.value.service]
}

function schedule(delay: number): void {
  clearTimeout(timer)
  timer = setTimeout(() => void runBackup(), delay)
}

const PREFIX = `idb://${db.name}/`

function onMutation(parts: ObservabilitySet): void {
  if (!Object.keys(parts).some(part => part.startsWith(PREFIX)))
    return
  backupPending.value = true
  // A copy of the app in the background (the browser tab next to the installed app) leaves
  // the work to the visible one.
  if (document.visibilityState === 'visible')
    schedule(CHANGE_DELAY)
}

function onVisibilityChange(): void {
  // Best effort: the system may freeze the page before the upload ends.
  if (document.visibilityState === 'hidden' && backupPending.value)
    void runBackup()
}

function onOnline(): void {
  if (backupPending.value || backupState.value.error === 'unavailable')
    schedule(1_000)
}

/** Listens for changes and backs up soon; once per session, only when Drive is connected. */
export function startAutoBackup(): void {
  if (started)
    return
  started = true
  Dexie.on('storagemutated', onMutation)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  schedule(START_DELAY)
}

export function stopAutoBackup(): void {
  if (!started)
    return
  started = false
  clearTimeout(timer)
  Dexie.on.storagemutated.unsubscribe(onMutation)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
}

/** One backup at a time, also across the browser tab and the installed app. */
async function exclusively(work: () => Promise<BackupOutcome>): Promise<BackupOutcome> {
  if (!navigator.locks)
    return work()
  return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, lock => lock
    ? work()
    : 'skipped')
}

async function removeOldBackups(): Promise<void> {
  const provider = backupProvider()
  try {
    for (const old of backupsToRemove(await provider.list()))
      await provider.remove(old.id)
  }
  catch {
    // The next backup tries again.
  }
}

async function backUp(force: boolean): Promise<BackupOutcome> {
  // Never before the first start: an empty device must not go over the backups on Drive.
  if (!await getMeta('onboardedAt'))
    return 'skipped'
  const provider = backupProvider()
  const backup = await createBackup()
  const summary = await summarize(backup)
  backupPending.value = false
  const state = backupState.value
  if (!force && summary.checksum === state.lastChecksum)
    return 'unchanged'
  if (!state.trusted && (await provider.list()).length) {
    patchBackupState({ choice: true })
    return 'choice'
  }
  const day = today()
  // Compressed only now: most runs (at start, after a change undone) stop at the checksum.
  const { bytes, encrypted } = await sealBackup(backup)
  const file = await provider.upload({
    day,
    bytes,
    summary: { ...summary, encrypted },
    replaceId: state.todayFile?.day === day
      ? state.todayFile.id
      : undefined,
  })
  patchBackupState({
    lastBackupAt: summary.exportedAt,
    lastChecksum: summary.checksum,
    todayFile: { day, id: file.id },
    error: null,
    trusted: true,
  })
  await removeOldBackups()
  return 'uploaded'
}

/**
 * Backs up now, if Drive is connected and nothing stops it. Without changes since the last
 * backup it uploads nothing, unless `force`: «Esegui backup ora» uploads anyway, replacing
 * today's file (or making it again, if it was deleted on the service).
 */
export async function runBackup({ force = false }: { force?: boolean } = {}): Promise<BackupOutcome> {
  clearTimeout(timer)
  const state = backupState.value
  if (!state.connected || state.choice || state.error === 'auth')
    return 'skipped'
  if (backupRunning.value) {
    backupPending.value = true
    return 'skipped'
  }
  if (!navigator.onLine) {
    backupPending.value = true
    return 'offline'
  }
  backupRunning.value = true
  let outcome: BackupOutcome
  try {
    outcome = await exclusively(() => backUp(force))
  }
  catch (error) {
    backupPending.value = true
    outcome = errorCode(error)
    if (outcome !== 'offline')
      patchBackupState({ error: outcome })
  }
  finally {
    backupRunning.value = false
  }
  // Changes made while uploading go in the next backup.
  if (started && backupPending.value && (outcome === 'uploaded' || outcome === 'unchanged'))
    schedule(CHANGE_DELAY)
  return outcome
}

/** Checksum of the data on the device now, as the next backup would compute it. */
async function currentChecksum(): Promise<string> {
  return checksumOf((await createBackup()).data)
}

/**
 * Back from the service with the permission: who the account is, and a fresh start unless
 * it is the account this device already backed up to there.
 */
export async function completeConnection(service: ServiceId = 'google'): Promise<void> {
  const previous = backupState.value
  const sameService = previous.service === service
  patchBackupState({ service })
  let account: string | null = null
  try {
    account = await backupProvider().account() ?? null
  }
  catch {
    // Shown later; the backup works without it.
  }
  const sameAccount = sameService && account !== null && previous.account === account
  patchBackupState({
    connected: true,
    account,
    error: null,
    choice: false,
    ...(sameAccount
      ? {}
      : {
          lastBackupAt: null,
          lastChecksum: null,
          todayFile: null,
          trusted: false,
        }),
  })
  startAutoBackup()
}

/** Revokes the permission and forgets everything about the service; the backups stay there. */
export async function disconnectDrive(): Promise<void> {
  const { service } = backupState.value
  stopAutoBackup()
  resetBackupState()
  await serviceAuths[service].disconnect()
}

/** The user chose the data of this device: the next backups start from it. */
export function keepDeviceData(): Promise<BackupOutcome> {
  patchBackupState({ choice: false, trusted: true })
  return runBackup()
}

/** The device now holds a backup from Drive: no need to upload it back. */
export async function markRestoredFromDrive(backup: RemoteBackup): Promise<void> {
  patchBackupState({
    trusted: true,
    choice: false,
    error: null,
    lastBackupAt: backup.exportedAt,
    lastChecksum: await currentChecksum(),
    // Restored from today's file: the next backups of the day update it.
    todayFile: backup.day === today()
      ? { day: backup.day, id: backup.id }
      : null,
  })
  backupPending.value = false
}
