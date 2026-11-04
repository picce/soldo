# Soldo

PWA mobile-first per le spese quotidiane, **local-first**: i dati vivono in IndexedDB sul dispositivo e il backup va sul cloud dell'utente (Google Drive, poi Dropbox e OneDrive). Roadmap e decisioni: [docs/roadmap.md](docs/roadmap.md).

## Vincoli che non si negoziano

- **Nessun dato di spesa sui nostri server.** Niente database lato server per i dati dell'utente. Il Worker in `worker/` è stateless e gestisce solo token OAuth.
- **Offline anche in scrittura.** Ogni funzione deve funzionare senza rete; la rete serve solo per il backup.
- **Importi in centesimi interi** (`amountCents`), mai float. Date di calendario come stringhe `YYYY-MM-DD` locali.
- **Tutti i testi dell'interfaccia in `src/i18n/it.ts`**, niente stringhe hardcoded nei componenti.

## Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | Dev server Vite (con il Worker in locale via `@cloudflare/vite-plugin`) |
| `pnpm build` | Build di PWA + Worker in `dist/` |
| `pnpm preview` | Serve la build con workerd, come in produzione |
| `pnpm lint` / `pnpm lint:fix` | ESLint (`@antfu/eslint-config`, fa anche da formatter) |
| `pnpm typecheck` | `vue-tsc -b` su app, config Node e Worker |
| `pnpm test` | Vitest (happy-dom + `fake-indexeddb`) |
| `pnpm test:e2e` | Playwright su Chromium mobile, contro `pnpm preview` (fa la build da solo, tranne in CI) |
| `pnpm check` | lint + typecheck + test + build |
| `pnpm cf-typegen` | Rigenera `worker-configuration.d.ts` dopo aver cambiato `wrangler.jsonc` |

Prima di chiudere un lavoro: `pnpm check` e `pnpm test:e2e` verdi.

La CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) gira sui push su `develop` e su tutte le pull request, dentro l'immagine Docker ufficiale di Playwright. `@playwright/test` è fissato a una versione esatta: quando lo aggiorni, aggiorna anche il tag dell'immagine nel workflow. Su `main` si arriva solo con una pull request da `develop`.

## Struttura

```
src/
  app/          router, componenti della shell (BottomNav, ReloadPrompt)
  components/   componenti riusabili (AppPage, poi Donut, Keypad, ...)
  features/     una cartella per sezione: home, transactions, budgets, stats, settings
  i18n/         messaggi (it.ts) e setup vue-i18n
  theme/        volver.css (design system in cascade layer) e app.css
  db/ domain/ backup/ import/   arrivano nelle fasi successive (vedi roadmap)
worker/         Worker Cloudflare: /api/* (static assets per tutto il resto)
e2e/            test Playwright
```

## Convenzioni

- **Volver**: i componenti `Vv*` sono auto-importati (solo JS). Quando usi un componente per la prima volta, aggiungi l'import del suo CSS in `src/theme/volver.css` nel layer `volver.components`. Prima di scrivere props o classi consulta le skill `volverjs-ui-vue` e `volverjs-style`: props e utility inventate falliscono in silenzio.
- **Icone**: solo nomi del set Volver `normal` già registrato, niente prefissi Iconify remoti (l'app deve funzionare offline). Il set definitivo arriva con lo studio grafico (Fase 1).
- **Colori e spaziature**: token del design system (`var(--color-…)`, `var(--spacing-…)`), mai hex nei componenti, così il tema scuro continua a funzionare.
- **CSS del design system in cascade layer**: il CSS dell'app (scoped o in `app.css`) vince sempre senza `!important`.
- **Componenti locali** importati esplicitamente; alias `@/` → `src/`.
- **Accessibilità**: ogni controllo ha un nome accessibile; i test e2e cercano gli elementi per ruolo e nome.

## Deploy

Cloudflare Workers con static assets (`wrangler.jsonc`). Il deploy parte da Workers Builds collegato al repository GitHub: build `pnpm build`, deploy `npx wrangler deploy`, anteprime per branch con `npx wrangler versions upload`. Header di sicurezza e CSP in `public/_headers`: se aggiungi una chiamata a un dominio esterno (es. Google API), aggiorna `connect-src`.
