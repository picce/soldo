# Tema Taccuino nell'app

> **Stato**: Rilasciata
> **Data**: 2026-11-05
> **Ambito**: Porta nel codice la direzione grafica Taccuino: token chiari e scuri, font IBM Plex self-hosted, icone Phosphor in una collezione locale, app shell ridisegnata e icona A · Quaderno nel manifest. Chiude la Fase 1 della roadmap.
> **Spec collegate**: [`lingua-inglese.md`](./lingua-inglese.md) (stessa fase: i testi nuovi nascono in italiano e in inglese, e i messaggi precompilati contribuiscono al peso)

## Panoramica

Il 2026-11-05 sono stati approvati i mockup del Taccuino ([docs/design](../../design/README.md)) ed è stata scelta l'icona A · Quaderno. L'app pubblicata con la Fase 0 usa ancora il tema predefinito di Volver, l'icona provvisoria blu, le icone `normal` di Volver e tutto il CSS delle utility.

Il peso iniziale, misurato con `pnpm build` il 2026-11-05, è di 113,5 kB di JS e 67,2 kB di CSS (gzip). Quasi tutto il CSS sono utility che l'app non usa; nel JS pesano la collezione di icone `normal` (24 kB gzip) e il compilatore dei messaggi di vue-i18n.

Questa spec applica il tema all'app shell (sfondo, navigazione, titoli, avvisi), mette l'icona definitiva nel manifest e riduce il peso. Le schermate vere (Home con rendiconto, aggiunta rapida, Movimenti, Onboarding) arrivano con la Fase 2 e useranno gli stessi token e componenti.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - token CSS del Taccuino, con nomi inglesi, nei temi chiaro e scuro; il tema segue quello del sistema;
  - componenti Volver allineati al tema tramite i loro token, senza `!important`;
  - IBM Plex Sans e Mono self-hosted (sottoinsieme latino, pesi 400, 500 e 600), disponibili offline;
  - icone Phosphor in una collezione locale che contiene solo le icone usate, generata da uno script;
  - app shell come nei mockup: sfondo a quadretti, barra di navigazione, titolo di pagina, logo «soldo.» nella Home, avviso di aggiornamento in stile Taccuino;
  - icona A · Quaderno per favicon, iOS e Android (maskable), con colori del manifest e `theme-color` coerenti;
  - peso totale (JS + CSS gzip) almeno dimezzato: da 180,7 kB a 90 kB o meno.
- **Non-obiettivi**:
  - il contenuto delle schermate (rendiconto, barra per categoria, tastierino, griglia delle categorie, lista dei movimenti): Fase 2;
  - le microinterazioni (transizioni tra periodi, vibrazione del tastierino, animazione della barra): si fanno con i rispettivi componenti, in Fase 2;
  - la pagina interna `/dev/ui`: rimandata alla Fase 2, quando ci saranno componenti da mostrare;
  - un interruttore manuale chiaro/scuro: per ora il tema segue il sistema; i selettori `.theme--light` e `.theme--dark` sono già pronti.

## Design

### Token

I token vivono in `src/theme/tokens.css`, fuori dai cascade layer, quindi vincono sul CSS di Volver. I valori chiari stanno su `:root`; quelli scuri in `@media (prefers-color-scheme: dark)` su `:root:not(.theme--light)` e, per forzarli, su `.theme.theme--dark`. I nomi seguono la tabella dei colori di [docs/design](../../design/README.md):

| Design | CSS |
|---|---|
| carta | `--color-paper` |
| superficie | `--color-card` |
| quadretti | `--color-grid` |
| linea | `--color-line` |
| inchiostro | `--color-ink` |
| testo-2 | `--color-ink-2` |
| biro | `--color-pen` |
| su-biro | `--color-on-pen` |
| entrate | `--color-income` |
| categoria 1…8 | `--color-category-1` … `--color-category-8` |

Nello stesso file i token di Volver puntano ai nostri: `--color-brand` a `--color-pen`, `--color-word*` a `--color-ink` e `--color-ink-2`, `--color-surface*` a carta e superficie, `--font-sans` e `--font-mono` a IBM Plex, `--rounded` a 8 px, e i token di `vv-button` (primario in biro, secondario su superficie con bordo in inchiostro). Il tema scuro di Volver non serve più: i nostri token cambiano già nei due temi.

Tipografia: gli stili di testo usati da più componenti sono classi globali in `src/theme/app.css` (`.type-title`, `.type-body`, `.type-body-strong`, `.type-small`, `.type-label`, `.type-note`, `.type-amount`); il resto sta nel CSS scoped del componente. Le utility di Volver non si caricano più. `--color-scheme` passa a `dark` nel tema scuro, così anche i controlli nativi del browser si adeguano.

### Font

`src/theme/fonts.css` importa da `@fontsource/ibm-plex-sans` e `@fontsource/ibm-plex-mono` i file `latin-400.css`, `latin-500.css` e `latin-600.css`. Vite li copia tra gli asset e il service worker li mette in cache (`woff2` è già nei `globPatterns`). La CSP non cambia (`font-src 'self'`).

### Icone

- `scripts/build-icons.js` legge `@iconify-json/ph` e scrive `src/assets/icons/ph.json` con le sole icone elencate nello script, nei pesi Light e Regular. Si lancia con `pnpm icons` quando serve un'icona nuova; il JSON generato è versionato.
- `src/components/AppIcon.vue` avvolge `VvIcon` con prefisso `ph` e una prop `weight` (`light` di base, `regular` per lo stato attivo).
- `src/main.ts` registra solo `ph.json`; la collezione `normal` di Volver esce dal bundle. Nessun componente Volver usato dall'app dipende da quella collezione.

### App shell

- `src/theme/app.css`: sfondo `--color-paper` con la griglia di quadretti da 20 px sfasata di 10 px (due `linear-gradient`), testo in `--color-ink`, font Sans.
- `src/components/AppPage.vue`: titolo di pagina nello stile Titolo (Sans 600, 24 px, −1%), sostituibile con lo slot `title`, e la prop `intro` per il testo introduttivo.
- `src/components/AppLogo.vue` (nuovo): «soldo.» in Mono 600, punto in `--color-pen` accostato di 0,18 em. La Home lo usa come titolo di livello 1 al posto di «Home».
- `src/app/components/BottomNav.vue`: barra su `--color-card` con bordo superiore `--color-line`; voce attiva in `--color-ink`, peso 600, icona Regular e barretta `--color-pen` da 28×2 px in alto; voci inattive in `--color-ink-2` con icona Light. Icone: `house`, `receipt`, `piggy-bank`, `chart-pie-slice`, `gear-six`.
- `src/app/components/ReloadPrompt.vue`: avviso su `--color-card` con bordo in `--color-ink`, come l'avviso di eliminazione dei mockup; azioni con `VvButton`. Non usa più `VvAlert`.
- `src/features/*/*View.vue`: il testo introduttivo passa dalla prop `intro` di `AppPage` (Sans 15, `--color-ink-2`), senza utility.

### Icona e manifest

- `public/logo.svg`: l'icona A · Quaderno a tutta pagina (carta, quadretti, «s» in inchiostro, punto in biro) con il testo convertito in tracciati, esportata da FigCraft.
- `pwa-assets.config.ts`: le icone maskable e Apple usano il disegno a tutta pagina senza margine aggiunto, perché il segno sta già nella zona sicura.
- `vite.config.ts`: `background_color` e `theme_color` del manifest diventano carta (`#F5F4EF`).
- `index.html`: due `meta name="theme-color"`, carta per il tema chiaro e `#141414` per quello scuro.

### Peso

`src/theme/volver.css` carica solo `base` (reset e token di Volver) e i componenti usati (`vv-button`, `vv-button-group`). Spariscono `utilities`, `vv-alert` e il tema scuro. Il resolver di Volver in `vite.config.ts` e `vitest.config.ts` usa `cherryPick`: importa ogni componente dal suo file invece che dall'indice di tutta la libreria, che si portava dietro Floating UI e componenti non usati (circa 26 kB gzip). Insieme ai messaggi precompilati della spec [`lingua-inglese.md`](./lingua-inglese.md) il peso deve scendere sotto i 90 kB gzip.

Misura del 2026-11-05 (`pnpm build`, bundle principale): 71,6 kB di JS e 13,2 kB di CSS, in tutto 84,9 kB contro i 180,7 kB di partenza. I font (115 kB in `woff2`) sono a parte: si scaricano una volta e restano nella cache del service worker.

### Test e documenti

- `src/app/components/BottomNav.test.ts`: voci, voce attiva, icona Regular sulla voce attiva.
- `e2e/app-shell.spec.ts`: titolo della Home, icone del manifest (maskable e `any`), `theme-color`.
- `docs/design/README.md`: colonna con il nome CSS nella tabella dei colori.
- `AGENTS.md`: icone dalla collezione `ph` tramite `AppIcon`, niente utility di Volver.

## Fasi di rilascio

1. **Token, font e shell**: `pnpm check` e `pnpm test:e2e` verdi; screenshot della shell a 390 px in chiaro e in scuro confrontati con i mockup.
2. **Icona e manifest**: il manifest generato elenca le icone `any` e `maskable`; il favicon e l'icona Apple mostrano la «s.» su carta a quadretti.
3. **Peso**: `pnpm build` riporta JS + CSS gzip sotto i 90 kB (fatto: 84,9 kB).
4. **Pubblicazione**: pull request da `develop` a `main` insieme a [`lingua-inglese.md`](./lingua-inglese.md); prova da installata su Android e iOS.
