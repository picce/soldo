/**
 * A statement shared to Soldo from another app on Android (docs/specs/released/import-da-file.md,
 * "Condividi verso Soldo"): public/share-target.js, in the service worker, puts it in this
 * cache and opens the import page. Read once, then deleted.
 */

export const SHARE_CACHE = 'soldo-share'
export const SHARED_FILE_URL = '/importa/condiviso/file'

export async function takeSharedStatement(): Promise<File | null> {
  if (typeof caches === 'undefined')
    return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const response = await cache.match(SHARED_FILE_URL)
    if (!response)
      return null
    await cache.delete(SHARED_FILE_URL)
    const name = decodeURIComponent(response.headers.get('X-File-Name') ?? 'estratto-conto')
    const blob = await response.blob()
    return new File([blob], name, { type: blob.type })
  }
  catch {
    return null
  }
}
