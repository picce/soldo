# Soldo

PWA mobile-first per le spese quotidiane, **local-first**: i dati vivono in IndexedDB sul dispositivo e il backup va sul cloud dell'utente (Google Drive, poi Dropbox e OneDrive). Roadmap e decisioni: [docs/roadmap.md](docs/roadmap.md).

## Vincoli che non si negoziano

- **Nessun dato di spesa sui nostri server.** Niente database lato server per i dati dell'utente. Il Worker in `worker/` è stateless e gestisce solo token OAuth.
- **Offline anche in scrittura.** Ogni funzione deve funzionare senza rete; la rete serve solo per il backup.
- **Importi in centesimi interi** (`amountCents`), mai float. Date di calendario come stringhe `YYYY-MM-DD` locali.
- **Tutti i testi dell'interfaccia in `src/i18n/locales/it.json` ed `en.json`**, sempre in entrambe le lingue; niente stringhe hardcoded nei componenti. Le chiavi devono coincidere (lo controllano typecheck e `src/i18n/locale.test.ts`).

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
| `E2E_BASE_URL=<url> pnpm test:e2e` | Gli stessi test contro un sito pubblicato: produzione `https://soldo.nridolfi.workers.dev`, anteprima di `develop` `https://develop-soldo.nridolfi.workers.dev` |
| `pnpm check` | lint + typecheck + test + build |
| `pnpm cf-typegen` | Rigenera `worker-configuration.d.ts` dopo aver cambiato `wrangler.jsonc` |
| `pnpm icons` | Rigenera `src/assets/icons/ph.json` dopo aver cambiato l'elenco in `scripts/build-icons.js` |

Prima di chiudere un lavoro: `pnpm check` e `pnpm test:e2e` verdi.

La CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) gira sui push su `develop` (non se cambiano solo `docs/` o file `.md`) e su tutte le pull request; un giro dura meno di un minuto. Su `main` si arriva solo con una pull request da `develop`.

## Struttura

```
src/
  app/          router, componenti della shell (BottomNav, ReloadPrompt, AppToast) e avvisi (toast.ts: showToast)
  assets/icons/ ph.json: le icone Phosphor usate, generate da scripts/build-icons.js
  components/   componenti riusabili (AppPage, AppIcon, AppLogo, SegmentedControl, Keypad, CategoryGrid, AmountText, ActionChip, BottomSheet)
  features/     una cartella per sezione: home, transactions, budgets, stats, settings; dev/ è la pagina /dev/ui (solo in sviluppo)
  i18n/         testi (locales/it.json, locales/en.json), setup vue-i18n e scelta della lingua (locale.ts)
  theme/        tokens.css (token Taccuino), fonts.css (IBM Plex), volver.css (design system in cascade layer), app.css
  db/           database Dexie (schema, repository, dati iniziali, useLiveQuery)
  domain/       funzioni pure: importi, date, periodi, riepiloghi, calcolatrice
  test/         supporto ai test unitari (plugins.ts: i18n e Volver con le icone locali)
  backup/ import/   arrivano nelle fasi successive (vedi roadmap)
scripts/        script di sviluppo (build-icons.js)
worker/         Worker Cloudflare: /api/* (static assets per tutto il resto)
design/         file di design FigCraft (soldo.figcraft): fondamenta, schermate, identità
docs/specs/     spec dei lavori, attive e in released/ o archived/
e2e/            test Playwright
```

## Convenzioni

- **Lingua**: cartelle, nomi e commenti del codice in inglese, anche i titoli dei test. Documentazione (README, roadmap, spec, design) e testi dell'interfaccia in italiano; l'interfaccia ha anche l'inglese.
- **Spec**: ogni lavoro parte da una spec in `docs/specs/` (skill `new-spec`), elencata nella tabella «Spec attive» di [docs/roadmap.md](docs/roadmap.md); a lavoro pubblicato la spec va in `docs/specs/released/`.
- **Git flow**: ogni spec si implementa su un branch `feature/<nome-della-spec>` (`git flow feature start <nome>`; in un clone nuovo prima `git flow init` con `main` come branch di produzione, `develop` e prefisso dei tag `v`), che a lavoro finito e con `pnpm check` e `pnpm test:e2e` verdi si chiude su `develop` (`git flow feature finish <nome>`). Su `develop` direttamente vanno solo documenti e piccole correzioni.
- **Commit**: niente trailer `Co-Authored-By` nei messaggi.
- **Rilasci**: ogni rilascio su `main` alza la minor (`0.1.0`, `0.2.0`, …) in `package.json`, ha le note per chi usa l'app in `docs/changelog/<versione>.md` (skill `changelog`, in italiano) e il tag `v<versione>` sul merge in `main`.
- **Volver**: i componenti `Vv*` sono auto-importati uno per uno (resolver con `cherryPick`, solo JS). Quando usi un componente per la prima volta, aggiungi l'import del suo CSS in `src/theme/volver.css` nel layer `volver.components`. Le utility e il tema scuro di Volver non sono caricati: niente classi utility (`p-md`, `text-16`, …), si usa CSS scoped con i token. Prima di scrivere props consulta la skill `volverjs-ui-vue`: props inventate falliscono in silenzio.
- **Design**: le regole sono in [docs/design/README.md](docs/design/README.md) (direzione Taccuino: colori, tipografia, icone, componenti, tono di voce), i mockup in `design/soldo.figcraft` (FigCraft 0.15.1, editor open source in locale; con `figcraft-cli` si esportano gli screenshot in `docs/design/render/`). Il design vive nel repository, non in Figma.
- **Icone**: `AppIcon` con il nome Phosphor (`<AppIcon name="house" />`, peso Light; `weight="regular"` per lo stato attivo). Per un'icona nuova aggiungila in `scripts/build-icons.js` e lancia `pnpm icons`. Niente prefissi Iconify remoti: l'app deve funzionare offline.
- **Colori e testo**: token di `src/theme/tokens.css` (`--color-paper`, `--color-card`, `--color-line`, `--color-ink`, `--color-ink-2`, `--color-pen`, `--color-income`, `--color-category-1…8`), mai hex nei componenti, così il tema scuro continua a funzionare. Gli stili di testo condivisi sono le classi `.type-*` di `src/theme/app.css`.
- **CSS del design system in cascade layer**: il CSS dell'app (scoped o in `app.css`) vince sempre senza `!important`.
- **Componenti locali** importati esplicitamente; alias `@/` → `src/`. Ogni componente nuovo va anche nella pagina `/dev/ui` (`src/features/dev/DevUiView.vue`), in chiaro e in scuro.
- **Test dei componenti**: montali con `global: { plugins: testPlugins() }` (`src/test/plugins.ts`), così le icone restano locali.
- **Accessibilità**: ogni controllo ha un nome accessibile; i test e2e cercano gli elementi per ruolo e nome.

## Deploy

Cloudflare Workers con static assets (`wrangler.jsonc`). Il deploy parte da Workers Builds collegato al repository GitHub: build `pnpm build`, deploy `npx wrangler deploy`, anteprime per branch con `npx wrangler versions upload`. Header di sicurezza e CSP in `public/_headers`: se aggiungi una chiamata a un dominio esterno (es. Google API), aggiorna `connect-src`.
