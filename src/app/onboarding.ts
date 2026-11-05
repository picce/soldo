import { db } from '@/db/database'
import { now } from '@/db/records'
import { getMeta, setMeta } from '@/db/repositories/meta'

/**
 * First start (docs/specs/released/onboarding.md): done once `meta.onboardedAt` exists. Loaded
 * lazily by the router guard, so the database stays out of the first chunk.
 */

/** Once true it stays true for the session: the guard reads the database only until then. */
let onboarded = false

export async function isOnboarded(): Promise<boolean> {
  if (onboarded)
    return true
  if (await getMeta('onboardedAt')) {
    onboarded = true
    return true
  }
  // Data from before the onboarding existed (e.g. the develop preview), or a restored
  // backup without the mark: the app is already in use, no welcome.
  if (await db.categories.count()) {
    await markOnboarded()
    return true
  }
  return false
}

export async function markOnboarded(): Promise<void> {
  await setMeta('onboardedAt', now())
  onboarded = true
}

/** Forgets the cached answer; tests only. */
export function forgetOnboarding() {
  onboarded = false
}
