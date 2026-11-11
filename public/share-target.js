/**
 * A bank statement shared to Soldo from another app on Android (docs/specs/import-da-file.md,
 * "Condividi verso Soldo"). The service worker loads this file with importScripts, before its
 * own routes: the POST of the share sheet never reaches the network. The file waits in a cache
 * until the import page takes it (src/features/import/shared.ts).
 */
const SHARE_ACTION = '/api/share-target'
const SHARE_CACHE = 'soldo-share'
const SHARED_FILE_URL = '/importa/condiviso/file'
const IMPORT_PAGE = '/impostazioni/importa?condiviso=1'

async function keepSharedStatement(request) {
  try {
    const data = await request.formData()
    const file = data.get('statement')
    if (file && typeof file !== 'string') {
      const cache = await caches.open(SHARE_CACHE)
      await cache.put(SHARED_FILE_URL, new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'estratto-conto'),
        },
      }))
    }
  }
  catch {
    // The page says the file did not arrive.
  }
  return Response.redirect(new URL(IMPORT_PAGE, globalThis.location.origin).href, 303)
}

globalThis.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.origin === globalThis.location.origin && url.pathname === SHARE_ACTION)
    event.respondWith(keepSharedStatement(event.request))
})
