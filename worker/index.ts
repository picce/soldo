import type { GoogleSecrets } from './google'
import { handleGoogle } from './google'

/**
 * Soldo's Cloudflare Worker.
 *
 * It only serves /api/* (see `run_worker_first` in wrangler.jsonc); everything else is the
 * PWA's static assets. The Worker is stateless and never receives expense data: it only
 * signs in to Google Drive and hands out access tokens (docs/specs/backup-google-drive.md).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health')
      return Response.json({ ok: true, service: 'soldo' })

    const google = await handleGoogle(request, env)
    if (google)
      return google

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler<Env & GoogleSecrets>
