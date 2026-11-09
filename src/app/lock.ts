import { computed, readonly, ref, shallowRef } from 'vue'

/**
 * The PIN lock (docs/specs/released/blocco-pin.md): a screen over the app at start and when it comes
 * back after a while. It hides the app, it does not encrypt the data. The PIN is never
 * kept: only its PBKDF2 hash, in localStorage, so it does not travel inside the backups.
 * Light on purpose: main.ts loads it with the first chunk.
 */

/** Seconds out of the app before it locks: at once, after 1 minute, after 5 minutes. */
export type LockDelay = 0 | 60 | 300
export const LOCK_DELAYS: LockDelay[] = [0, 60, 300]
/** Names of the delays in the texts (src/i18n/locales). */
export const DELAY_NAMES = { 0: 'now', 60: 'minute', 300: 'fiveMinutes' } as const satisfies Record<LockDelay, string>
export const PIN_LENGTH = 4

interface StoredLock {
  hash: string
  salt: string
  iterations: number
  after: LockDelay
}

interface Attempts {
  failures: number
  /** Until when no PIN is checked, epoch ms. */
  until: number
}

export const LOCK_KEY = 'soldo.lock'
export const ATTEMPTS_KEY = 'soldo.lock.attempts'
const ITERATIONS = 100_000
/** Wrong PINs allowed before a wait. */
const FREE_FAILURES = 5
const FIRST_WAIT = 30_000
const LONGEST_WAIT = 15 * 60_000
/**
 * Even «at once» waits this long out of the app: picking a file or sharing a backup takes
 * the page to the background for a moment, and must not lock it.
 */
const SHORTEST_AWAY = 2_000

function read<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    return stored
      ? JSON.parse(stored) as T
      : null
  }
  catch {
    return null
  }
}

function write(key: string, value: object | null): void {
  try {
    if (value)
      localStorage.setItem(key, JSON.stringify(value))
    else
      localStorage.removeItem(key)
  }
  catch {
    // Storage full or blocked: it lasts for this session.
  }
}

function loadLock(): StoredLock | null {
  const value = read<Partial<StoredLock>>(LOCK_KEY)
  return value && typeof value.hash === 'string' && typeof value.salt === 'string' && typeof value.iterations === 'number'
    ? {
        hash: value.hash,
        salt: value.salt,
        iterations: value.iterations,
        after: LOCK_DELAYS.includes(value.after as LockDelay)
          ? value.after as LockDelay
          : 0,
      }
    : null
}

const stored = shallowRef<StoredLock | null>(loadLock())
const isLocked = ref(false)

/** The lock of this device: `null` when off. */
export const appLock = computed(() => stored.value && { after: stored.value.after })
/** The lock screen is up. */
export const locked = readonly(isLocked)

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0))
}

async function hashPin(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, material, 256)
  return toBase64(new Uint8Array(bits))
}

function save(next: StoredLock | null): void {
  stored.value = next
  write(LOCK_KEY, next)
}

/** Turns the lock on, or changes the PIN. `iterations` only for tests. */
export async function enableLock(pin: string, after: LockDelay, iterations = ITERATIONS): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  save({
    hash: await hashPin(pin, salt, iterations),
    salt: toBase64(salt),
    iterations,
    after,
  })
  write(ATTEMPTS_KEY, null)
}

export function changeLockDelay(after: LockDelay): void {
  if (stored.value)
    save({ ...stored.value, after })
}

export function disableLock(): void {
  save(null)
  write(ATTEMPTS_KEY, null)
  isLocked.value = false
}

/** Until when the PIN cannot be tried, epoch ms; 0 when it can. */
export function waitUntil(now = Date.now()): number {
  const until = read<Attempts>(ATTEMPTS_KEY)?.until ?? 0
  return until > now
    ? until
    : 0
}

/** 30 seconds after the fifth wrong PIN, then twice as long at each one, at most 15 minutes. */
function waitAfter(failures: number): number {
  return failures < FREE_FAILURES
    ? 0
    : Math.min(FIRST_WAIT * 2 ** (failures - FREE_FAILURES), LONGEST_WAIT)
}

/** Checks the PIN: the screen goes on the right one. */
export async function unlock(pin: string, now = Date.now()): Promise<'ok' | 'wrong' | 'wait'> {
  const lock = stored.value
  if (!lock) {
    isLocked.value = false
    return 'ok'
  }
  if (waitUntil(now))
    return 'wait'
  const hash = await hashPin(pin, fromBase64(lock.salt), lock.iterations)
  if (hash === lock.hash) {
    write(ATTEMPTS_KEY, null)
    isLocked.value = false
    return 'ok'
  }
  const failures = (read<Attempts>(ATTEMPTS_KEY)?.failures ?? 0) + 1
  const wait = waitAfter(failures)
  write(ATTEMPTS_KEY, {
    failures,
    until: wait
      ? now + wait
      : 0,
  })
  return wait
    ? 'wait'
    : 'wrong'
}

let hiddenAt: number | undefined
let started = false

function onVisibilityChange(): void {
  if (!stored.value)
    return
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }
  if (hiddenAt === undefined)
    return
  const away = Date.now() - hiddenAt
  hiddenAt = undefined
  if (away >= Math.max(stored.value.after * 1000, SHORTEST_AWAY))
    isLocked.value = true
}

function onStorage(event: StorageEvent): void {
  // Another tab (the installed app and the browser) turned the lock on or off.
  if (event.key === LOCK_KEY)
    stored.value = loadLock()
}

/** At start: locked when the lock is on; then again after the chosen time away. */
export function startLock(): void {
  isLocked.value = stored.value !== null
  if (started)
    return
  started = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('storage', onStorage)
}

/** Reads the stored lock again; tests only. */
export function reloadLock(): void {
  stored.value = loadLock()
  isLocked.value = false
  hiddenAt = undefined
}
