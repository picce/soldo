# Soldo

Le tue spese quotidiane, anche offline. Soldo è una web app installabile (PWA) che salva i dati sul tuo dispositivo e ne fa il backup sul tuo cloud: i dati restano tuoi.

## Sviluppo

Serve Node 22 e pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm check        # lint, typecheck, test, build
pnpm test:e2e     # test end-to-end (la prima volta: pnpm exec playwright install chromium)
```

## Deploy su Cloudflare

1. Crea un account Cloudflare (piano gratuito).
2. In **Workers & Pages → Create → Import a repository**, collega questo repository GitHub.
3. Imposta build command `pnpm build` e deploy command `npx wrangler deploy`. Per le anteprime dei branch: `npx wrangler versions upload`.
4. L'app sarà online su `https://soldo.<tuo-sottodominio>.workers.dev`.

In alternativa, dal tuo computer: `npx wrangler login` e poi `pnpm deploy`.

## Documentazione

- [Roadmap e decisioni](docs/roadmap.md), con le [spec](docs/specs/) dei lavori in corso
- [Design](docs/design/README.md)
- [Note di rilascio](docs/changelog/)
- [Convenzioni per chi sviluppa](AGENTS.md)
