/**
 * Worker Cloudflare di Soldo.
 *
 * Serve solo le rotte /api/* (vedi `run_worker_first` in wrangler.jsonc); tutto il resto
 * sono static assets della PWA. Il Worker è stateless e non riceve mai dati di spesa:
 * dalla Fase 3 gestirà soltanto lo scambio e il rinnovo dei token OAuth di Google Drive.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health')
      return Response.json({ ok: true, service: 'soldo' })

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
} satisfies ExportedHandler<Env>
