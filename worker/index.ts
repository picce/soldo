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
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health')
      return Response.json({ ok: true, service: 'soldo' })

    for (const handle of [handleGoogle, handleDropbox, handleOneDrive]) {
      const response = await handle(request, env)
      if (response)
        return response
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler<Env & Secrets>
