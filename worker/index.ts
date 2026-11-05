/**
 * Soldo's Cloudflare Worker.
 *
 * It only serves /api/* (see `run_worker_first` in wrangler.jsonc); everything else is the
 * PWA's static assets. The Worker is stateless and never receives expense data: from Phase 3
 * it will only exchange and refresh Google Drive OAuth tokens.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health')
      return Response.json({ ok: true, service: 'soldo' })

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler<Env>
