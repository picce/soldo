import type { DropboxSecrets } from './dropbox'
import type { GoogleSecrets } from './google'
import type { OneDriveSecrets } from './onedrive'
import { handleDropbox } from './dropbox'
import { handleGoogle } from './google'
import { handleOneDrive } from './onedrive'

type Secrets = GoogleSecrets & DropboxSecrets & OneDriveSecrets

/**
 * Soldo's Cloudflare Worker.
 *
 * It only serves /api/* (see `run_worker_first` in wrangler.jsonc); everything else is the
 * PWA's static assets. The Worker is stateless and never receives expense data: it only
 * signs in to the backup services (Google Drive, Dropbox, OneDrive) and hands out access
 * tokens (docs/specs/backup-google-drive.md, docs/specs/backup-dropbox-onedrive.md).
 * A statement shared from another app is taken by the service worker, never sent here.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health')
      return Response.json({ ok: true, service: 'soldo' })

    // A file shared before the service worker was there to take it (public/share-target.js):
    // the import page says to share it again. The file is not read, nor kept.
    if (url.pathname === '/api/share-target' && request.method === 'POST')
      return Response.redirect(new URL('/impostazioni/importa?condiviso=1', url.origin).href, 303)

    for (const handle of [handleGoogle, handleDropbox, handleOneDrive]) {
      const response = await handle(request, env)
      if (response)
        return response
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler<Env & Secrets>
