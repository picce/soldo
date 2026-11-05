/**
 * Asks the browser not to evict the app's storage under pressure. Called at onboarding;
 * returns whether the storage is persistent. Browsers may refuse silently.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist)
    return false
  if (await navigator.storage.persisted())
    return true
  return navigator.storage.persist().catch(() => false)
}
