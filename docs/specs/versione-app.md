# Versione dell'app nelle Impostazioni

> **Stato**: Parziale (implementata su `develop` il 2026-11-05; esce con la prossima pull request verso `main`)
> **Data**: 2026-11-05
> **Ambito**: Le Impostazioni mostrano la versione dell'app in uso e il commit da cui è stata costruita, così si capisce subito quale build gira sul telefono.
> **Spec collegate**: Nessuna

## Panoramica

Soldo è una PWA: il service worker tiene in cache l'app e la aggiorna solo quando l'utente accetta l'avviso «Nuova versione disponibile». Oggi non c'è modo di sapere quale versione è installata, né di distinguere la produzione dall'anteprima di `develop`. Il 2026-11-05 è stato chiesto di mostrare la versione corrente, per esempio nelle Impostazioni.

La versione è quella di `package.json` (dalla 0.1.0 segue le note in `docs/changelog/`). Il commit serve a distinguere due build con lo stesso numero, come l'anteprima di `develop` e la produzione.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - in fondo alle Impostazioni, una sezione «Informazioni» con la riga «Versione 0.1.0 · b42d6f9»;
  - numero e commit fissati in build, quindi corretti anche offline e senza chiamate di rete;
  - testi in italiano e in inglese.
- **Non-obiettivi**:
  - le note di rilascio dentro l'app: stanno nel repository e richiederebbero contenuti da tenere offline;
  - un controllo «c'è una versione nuova?»: lo fa già il service worker con l'avviso di aggiornamento.

## Design

### Dati di build

- `build-info.ts` (nuovo, nella radice come gli altri file di configurazione): esporta `appDefines()`, che restituisce le costanti per l'opzione `define` di Vite:
  - `__APP_VERSION__`: `version` di `package.json`;
  - `__APP_COMMIT__`: i primi 7 caratteri del commit, presi in quest'ordine da `WORKERS_CI_COMMIT_SHA` (Cloudflare Workers Builds), `GITHUB_SHA` (GitHub Actions) e `git rev-parse --short HEAD`; se nessuno è disponibile, stringa vuota.
- `vite.config.ts` e `vitest.config.ts`: `define: appDefines()`.
- `tsconfig.node.json`: include `build-info.ts`.
- `src/env.d.ts`: dichiara le due costanti come `string`.

### Impostazioni

- `src/features/settings/SettingsView.vue`: sotto la sezione «Lingua», la sezione «Informazioni» con titolo nello stile Etichetta e la riga della versione nello stile Nota (Mono 13, `--color-ink-2`). Senza commit la riga mostra solo il numero.
- Testi in `src/i18n/locales/it.json` ed `en.json`: `settings.about.label` («Informazioni», «About»), `settings.about.version` («Versione {version}», «Version {version}»).

### Test

- `src/features/settings/SettingsView.test.ts`: la sezione mostra la versione di `package.json`.
- `e2e/app-shell.spec.ts`: la pagina Impostazioni mostra «Versione» seguita dal numero di `package.json`.

## Fasi di rilascio

1. **Implementazione**: `pnpm check` e `pnpm test:e2e` verdi; sull'anteprima di `develop` la riga mostra il commit della build.
2. **Pubblicazione**: con la prossima pull request verso `main`, insieme alla minor successiva.
