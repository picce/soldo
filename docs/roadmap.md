# Soldo — piano di sviluppo

## Stato

| Fase | Stato |
|---|---|
| 0 — Fondamenta | Completata e pubblicata (2026-11-04): produzione da `main`, anteprima da `develop` |
| 1 — Studio grafico | Completata e pubblicata (2026-11-05): direzione **C · Taccuino** ([docs/design](design/README.md)), tema nell'app, icona A · Quaderno e lingua inglese (spec in [docs/specs/released](specs/released/)) |
| 2 — Nucleo local-first | Completata e pubblicata con la versione 0.2.0 (2026-11-05): aggiunta rapida, Home, Movimenti, categorie, backup manuale e CSV, onboarding (spec in [docs/specs/released](specs/released/)) |
| Prima della Fase 3 | Pubblicata con la versione 0.3.0 (2026-11-05): [sensazione da app nativa](specs/released/sensazione-nativa.md), cioè risposta al tocco, transizioni tra le pagine, gesti, liste e cifre animate |
| 3–7 | Da iniziare |

## Spec attive

Dal 2026-11-05 ogni lavoro parte da una spec in [docs/specs](specs/). Le spec completate vanno in `docs/specs/released/` ed escono da questa tabella.

| Spec | Ondata | Effort | Dipendenze | Stato |
|---|---|---|---|---|
| | | | | |

Al momento non ci sono spec attive.

## Contesto

Vogliamo una webapp per le spese quotidiane, mobile-first e **utilizzabile offline**, ispirata a Monefy e Speso.

- **Monefy**: aggiunta di una spesa in 2 tap, torta per categoria, conti, ricorrenze, backup sul Drive/Dropbox dell'utente.
- **Speso**: Vue 3 + Vite PWA + Supabase, sezioni Home/Movimenti/Statistiche/Budget/Impostazioni. Offline mostra solo i dati in cache, in sola lettura.

Requisiti emersi:
- tutti i dati vivono **sul dispositivo**, quindi l'app funziona offline anche in scrittura;
- i dati sono **di proprietà dell'utente**, con backup automatico **sul suo cloud** e nessun database nostro;
- hosting gratuito all'inizio, ma con spazio per crescere;
- funzioni da avere presto: conti e trasferimenti, budget mensili, spese ricorrenti;
- uno **studio grafico ad-hoc**, per non avere l'aspetto di un template;
- valutare come **leggere i movimenti dai conti correnti** esistenti.

Repo: `c:\dev\code\pigeon\soldo` (vuoto, remote `github.com/picce/soldo`). Ambiente: Node 22, pnpm 10.

## Decisioni prese

| Tema | Scelta | Motivo |
|---|---|---|
| Frontend | Vue 3 + Vite + TypeScript, `@volverjs/ui-vue` + `@volverjs/style` con tema personalizzato, vue-router, Pinia, vue-i18n (italiano e inglese, messaggi precompilati) | Stack noto, skill Volver disponibili |
| Form e validazione | `@volverjs/form-vue` + Zod (gli schemi Zod servono anche a validare backup e import) | Un solo modello di validazione |
| Dati locali | IndexedDB con **Dexie 4** e query reattive (`liveQuery` in un composable `useLiveQuery`) | Local-first, offline in lettura e scrittura |
| PWA | `vite-plugin-pwa`: precache dell'app shell, aggiornamento "nuova versione disponibile", manifest con icone maskable e shortcut "Nuova spesa", `navigator.storage.persist()` | Installabile, funziona in modalità aereo |
| Backup | Interfaccia `BackupProvider`. **Google Drive** per primo, poi Dropbox e OneDrive | I dati restano nello spazio dell'utente |
| Hosting | **Cloudflare**: Workers con static assets, che Cloudflare oggi consiglia al posto di Pages per i nuovi progetti (stesso piano gratuito). La PWA e la funzione per il token Google stanno in un unico deploy | Gratis, banda statica illimitata, uso commerciale consentito. Per crescere: Workers Paid 5 $/mese, più D1/R2/KV se servisse |
| Database server | **Nessuno** per ora: Neon non serve | Lo rivalutiamo solo se arrivano condivisione o account |
| Design | Studio grafico dedicato (Fase 1), tutto nel repository: mockup in [FigCraft](https://github.com/storytold/figcraft) (`design/soldo.figcraft`, editor open source in locale), regole e screenshot in `docs/design/`. Niente Figma. Nel codice: token CSS in `src/theme/tokens.css`, mappati sui token di `@volverjs/style` | Aspetto riconoscibile, non generico; il design è versionato con il codice |
| Repo | Una sola app Vite (niente Nx/monorepo-starter: Fastify e Postgres non servono) + `worker/` per le API | Semplicità |
| CI/CD | GitHub Actions (lint, typecheck, unit, e2e, build) + Cloudflare Workers Builds con URL di anteprima per branch | Gratis |
| Grafici | Componenti SVG fatti in casa (barra per categoria, barre/trend), seguendo la skill `dataviz` | Leggeri e coerenti con il tema |
| Date e importi | Importi in **centesimi interi** (formattati con `Intl.NumberFormat('it-IT')`), date `YYYY-MM-DD` locali, `date-fns` per i periodi | Niente errori di arrotondamento né di fuso orario |

### Perché serve una funzione serverless per Google Drive

Google non rilascia refresh token a un client che vive solo nel browser. Senza, il backup automatico si fermerebbe ogni ora.

Il Worker è **stateless** e non vede mai i dati di spesa:
- `POST /api/google/token` scambia `code` + PKCE `code_verifier` usando il `client_secret`, che è un secret del Worker. Salva il refresh token in un **cookie HttpOnly cifrato** (AES-GCM, `SameSite=Strict`) e restituisce l'access token al client.
- `POST /api/google/refresh` legge il cookie e restituisce un nuovo access token.
- `POST /api/google/disconnect` revoca il token e cancella il cookie.
- CORS limitato alla nostra origine; i token non vengono mai loggati.

Le chiamate alla Drive API partono direttamente dal browser, con lo scope `drive.file` (non sensibile). I backup sono visibili nella cartella "Soldo" del Drive dell'utente e sono accessibili da qualsiasi suo dispositivo.

## Modello dati (Dexie, schema v1)

Ogni record ha `id` (UUID generato sul client), `createdAt`, `updatedAt` e `deletedAt` (eliminazione logica). Costa poco subito e rende possibile in futuro un merge tra dispositivi.

| Tabella | Campi principali |
|---|---|
| `accounts` | name, type (cash/card/bank/other), icon, color, initialBalanceCents, currency, archived, order |
| `categories` | name, kind (expense/income), icon, color, order, archived |
| `transactions` | kind (expense/income/transfer), amountCents, currency, date, accountId, toAccountId (solo per i trasferimenti), categoryId, note, recurrenceId?, occurrenceDate?, **source** (manual/recurring/import/bank), **externalId?** (per la deduplicazione degli import) |
| `budgets` | month (`YYYY-MM`), categoryId (null = totale), amountCents, repeat |
| `recurrences` | template della transazione, freq (daily/weekly/monthly/yearly), interval, startDate, endDate?, lastGeneratedDate |
| `settings` / `meta` | preferenze, schemaVersion, stato del backup (ultimo backup, provider, errori) |
| `importRules`, `importPresets` (Fase 6) | parola chiave → categoria; mappatura delle colonne per banca |

Lo schema include fin da subito `accounts` con un conto predefinito "Contanti" e i campi `source`/`externalId`, così le fasi successive non richiedono migrazioni distruttive. Il campo `currency` è già presente ma la valuta resta fissa (EUR) finché non arriva il multi-valuta.

## Struttura del codice

```
src/
  app/          router, layout con bottom nav, plugin (Volver, i18n, PWA)
  theme/        token CSS del Taccuino, font, CSS di Volver in cascade layer
  db/           schema Dexie, migrazioni, repository, seed delle categorie
  domain/       TS puro e testabile: money, periodi, saldi, budget, ricorrenze
  backup/       engine (snapshot, gzip, retention, trigger), formato e migrazioni
    providers/  file, google-drive (poi dropbox, onedrive)
  import/       parser (CSV/XLSX/OFX/QIF/CAMT.053), mappatura, deduplicazione, regole
  features/     home, transactions, accounts, budgets, stats, settings, onboarding, import
  components/   CategoryBar, Keypad (con calcolatrice), CategoryGrid, PeriodSwitcher, AmountText
  i18n/         testi in italiano e inglese (JSON), scelta della lingua
worker/         Worker Cloudflare: static assets + /api/google/* (poi /api/bank/* se approvato)
```

---

## Fasi

Ogni fase si chiude con un deploy funzionante e un checkpoint di revisione insieme, prima di passare alla successiva.

### Fase 0 — Fondamenta
- Scaffold Vite + Vue 3 + TS con pnpm; ESLint con `@antfu/eslint-config` (fa anche da formatter, quindi niente Prettier); Vitest + `fake-indexeddb`; Playwright.
- Setup Volver (`VolverPlugin`, stile base, tema chiaro/scuro), vue-router, Pinia, vue-i18n.
- App shell: bottom nav con Home · Movimenti · Budget · Statistiche · Impostazioni e pagine vuote.
- `vite-plugin-pwa`: manifest, icone provvisorie, service worker, prompt di aggiornamento.
- Worker Cloudflare (`wrangler.jsonc`, static assets con fallback SPA), CI su GitHub Actions, Workers Builds con anteprime.
- `AGENTS.md`/`CLAUDE.md` con comandi e convenzioni; questa roadmap in `docs/roadmap.md`.

**Fatto quando**: l'app vuota è online su `*.workers.dev`, si installa come app e si apre offline. La CI è verde.

### Fase 1 — Studio grafico ad-hoc
- **Identità**: logo e icona dell'app (anche maskable e per iOS), tono di voce dei testi.
- **Linguaggio visivo**: palette chiara e scura, tipografia (font self-hosted, così funziona offline), griglia e spaziature, raggi e ombre, un unico set di icone per le categorie, colori delle categorie distinguibili e accessibili in entrambi i temi (validati con il metodo della skill `dataviz`).
- **Direzione visiva**: tre direzioni esplorate, scelta **C · Taccuino** (2026-11-05). Specifiche e immagini in [docs/design](design/README.md).
- **Mockup delle schermate del nucleo**: Home con rendiconto, barra per categoria e selettore di periodo; aggiunta rapida (tastierino e categorie); Movimenti; Onboarding; stati vuoti. Si disegnano in FigCraft nel file `design/soldo.figcraft`, versionato nel repository, con le stesse variabili (chiaro/scuro) e gli stessi stili di testo. Gli screenshot vanno in `docs/design/render/`. Approvati il 2026-11-05, con l'icona A · Quaderno.
- **Aggiunta rapida**: importo, poi un tocco sulla categoria salva il movimento. Il tastierino fa anche i conti (+ − × ÷); data, conto e nota sono facoltativi (di base: oggi, il conto predefinito, nessuna nota).
- **Traduzione in codice**: token CSS del Taccuino mappati su quelli di Volver, font self-hosted, icone Phosphor locali, app shell e icona nel manifest. Spec: [Tema Taccuino nell'app](specs/released/tema-taccuino.md).
- **Lingua inglese** (anticipata dalla Fase 5 il 2026-11-05): lingua dal dispositivo, scelta nelle Impostazioni. Spec: [Lingua inglese](specs/released/lingua-inglese.md).
- **Peso iniziale**: a fine Fase 0 la shell pesava 113,5 kB di JS e 67,2 kB di CSS (gzip). Senza utility né tema scuro di Volver, con i soli componenti Volver usati, le icone usate e i messaggi precompilati il bundle principale pesa 71,6 kB di JS e 13,2 kB di CSS (misurato il 2026-11-05).
- **Microinterazioni** e pagina interna `/dev/ui`: spostate in Fase 2, insieme ai componenti a cui servono.
- Le schermate delle fasi successive (Budget, Conti, Statistiche, Backup, Import) si disegnano **all'inizio di ciascuna fase**, con lo stesso sistema.

**Fatto quando**: mockup approvati, tema applicato all'app shell, icona definitiva nel manifest.

### Fase 2 — Nucleo local-first (MVP usabile ogni giorno)

Le spec della fase sono nella tabella «Spec attive».

- Schema Dexie v1 completo, seed delle categorie di default (icone e colori dello studio grafico), conto "Contanti". I nomi delle voci predefinite seguono la lingua dell'app finché l'utente non le rinomina.
- **Aggiunta rapida** stile Monefy: tasti − e + in Home, tastierino con calcolatrice, griglia categorie, salvataggio. Data e nota sono opzionali; la scelta del conto compare con la Fase 4, quando i conti sono più di uno.
- **Home**: selettore di periodo (giorno/settimana/mese/anno) con swipe, rendiconto e barra per categoria, saldo del periodo (entrate − uscite). Toccando una categoria si apre la lista filtrata. Proposta: il periodo personalizzato passa alla Fase 5, con le statistiche.
- **Movimenti**: lista raggruppata per giorno, ricerca e filtri, modifica. Scorrendo una riga verso sinistra la si elimina, verso destra la si duplica con la data di oggi; in entrambi i casi un avviso offre «Annulla» per qualche secondo.
- **Categorie**: CRUD, riordino, archiviazione.
- **Backup manuale**: esportazione/importazione JSON (formato versionato, validato con Zod) ed esportazione CSV.
- Onboarding: "Inizia da zero" oppure "Importa file", più l'invito a installare l'app.
- **Microinterazioni**: transizioni tra periodi, feedback del tastierino (vibrazione su Android), animazione della barra per categoria.
- Pagina interna `/dev/ui` con tutti i componenti, per verificarli in chiaro e in scuro.
- Testi di ogni schermata in italiano e in inglese.
- Le schermate non coperte dai mockup approvati (modifica, data, nota, filtri, Impostazioni, categorie, importazione) si disegnano prima in FigCraft.

**Fatto quando**: si usa ogni giorno dal telefono anche in modalità aereo e i dati sopravvivono a chiusura e riavvio.

### Fase 3 — Backup automatico su Google Drive
- Interfaccia `BackupProvider` (`connect`, `status`, `upload`, `list`, `download`, `remove`) e provider `file` (quello della Fase 2 riadattato).
- **Backup engine**: snapshot del DB, JSON gzip (`CompressionStream`), checksum, nome con timestamp. Retention: ultimi 14 giornalieri + 12 mensili.
- **Trigger**: dopo le modifiche (con debounce), all'avvio se l'ultimo backup è vecchio, quando l'app va in background (best effort). Sui telefoni il backup gira **solo con l'app aperta**: è un limite delle PWA, ma ogni modifica avviene ad app aperta e quindi viene coperta.
- Provider **Google Drive**: OAuth code + PKCE con redirect (più affidabile della popup in una PWA installata), endpoint del Worker descritti sopra, upload multipart sulla Drive API v3 nella cartella "Soldo".
- **Ripristino**: dall'onboarding ("Ripristina da Google Drive") e dalle impostazioni. Elenco dei backup, anteprima (data, numero di movimenti), validazione, migrazione di schema, sostituzione dei dati locali.
- UI di stato: "Ultimo backup: 2 min fa", errori, "Riconnetti Google".
- Pagina privacy policy; progetto Google Cloud con client OAuth e consent screen.

**Fatto quando**: le modifiche finiscono su Drive in automatico, e su un secondo dispositivo il ripristino riporta tutti i dati.

### Fase 4 — Conti, trasferimenti, budget, ricorrenze
- **Conti**: CRUD, saldo iniziale, saldo corrente calcolato, filtro per conto in Home, vista "tutti i conti".
- **Trasferimenti**: `kind: transfer` con `accountId` → `toAccountId`, esclusi dalle statistiche di entrate e uscite.
- **Budget mensili**: budget totale e per categoria, barre di avanzamento, avvisi in-app all'80% e al 100%, "ripeti ogni mese", navigazione tra i mesi.
- **Ricorrenze**: regole (frequenza e intervallo, inizio e fine), generazione delle occorrenze scadute all'avvio con **ID deterministico** (regola + data), così non si creano duplicati. Elenco dei prossimi addebiti, modifica e stop della serie.

**Fatto quando**: affitto e abbonamenti compaiono da soli, i saldi dei conti sono corretti, il budget del mese mostra quanto resta.

### Fase 5 — Statistiche, altri provider, rifiniture
- **Statistiche**: trend mensile di entrate e uscite, andamento per categoria, confronto con il periodo precedente, media giornaliera, periodo personalizzato (se confermato lo spostamento dalla Fase 2).
- Provider **Dropbox** (PKCE con refresh token direttamente dal browser, cartella `Apps/Soldo`, nessun backend) e **OneDrive** (stesso schema del Worker usato per Google).
- **Cifratura opzionale** dei backup con passphrase (WebCrypto AES-GCM + PBKDF2), con un avviso chiaro: passphrase persa significa backup illeggibile.
- **Blocco con PIN** opzionale (è un blocco dell'interfaccia, non una cifratura), accessibilità, lista virtualizzata per lo storico lungo.
- Una passata con la skill `de-slopify` sull'interfaccia, per tenere fede allo studio grafico.

### Fase 6 — Movimenti dai conti correnti

**Le strade possibili**

| Via | Come funziona | Pro | Contro |
|---|---|---|---|
| **A. Import di file** (CSV/XLSX/OFX/QIF/CAMT.053) | L'utente esporta i movimenti dall'home banking e li importa in Soldo | Gratis, funziona offline e con qualunque banca, nessun intermediario: coerente con "i dati sono tuoi" | Passaggio manuale; ogni banca ha il suo formato |
| **B. Open Banking PSD2** tramite un aggregatore (es. Enable Banking, che copre molte banche italiane tramite CBI Globe) | L'utente autorizza la propria banca; il Worker scarica i movimenti e li passa all'app senza salvarli | Automatico | Serve un backend con le chiavi API, e i dati transitano da un terzo (va aggiornata la privacy policy). Costo a volume: per Enable Banking esiste una modalità ristretta sui propri conti, ma che sia gratuita è da verificare. Consenso da rinnovare periodicamente (in genere ogni 180 giorni). Carte di credito non sempre coperte. GoCardless Bank Account Data (ex Nordigen, gratuito) ha chiuso le nuove registrazioni |
| C. Lettura di notifiche o email della banca | Non fattibile in una PWA | — | — |

**Raccomandazione**: realizzare subito la via A, che è utile comunque, e trattare la B come studio di fattibilità con una decisione esplicita.

**6a — Import da file**
- Wizard: scelta del file, rilevamento del formato, mappatura delle colonne (data, descrizione, importo o dare/avere, separatori italiani `1.234,56`). Preset salvati per banca.
- Parser CSV/XLSX/OFX/QIF/CAMT.053 in un Web Worker; anteprima prima di confermare.
- **Deduplicazione**: `externalId` (hash di data + importo + descrizione normalizzata) per non reimportare due volte, e segnalazione dei "possibili duplicati" rispetto alle spese già inserite a mano (stesso importo, date vicine), con unione con un tap.
- **Auto-categorizzazione**: regole "descrizione contiene X → categoria Y" che si arricchiscono quando l'utente corregge una categoria.
- **Web Share Target** (solo Android): "Condividi" il file dall'app della banca direttamente verso Soldo.

**6b — Studio di fattibilità Open Banking**
- Confronto aggiornato tra i provider (Enable Banking, Salt Edge, Tink, Yapily, TrueLayer…): copertura delle banche che usi, costo per uso personale e per più utenti, condizioni contrattuali, durata del consenso.
- Prototipo con il tuo conto in sandbox o in modalità ristretta. Architettura: Worker come pass-through stateless, con token di sessione in un cookie cifrato come per Google; il matching dei movimenti resta nell'app.
- **Decisione**: si procede solo se il costo è sostenibile e se nessun dato resta sui server. Lo studio può partire in parallelo già durante la Fase 4, perché le registrazioni presso i provider richiedono tempo.

**Fatto quando**: l'estratto conto in CSV della tua banca si importa senza duplicati e con le categorie in gran parte già giuste; per l'Open Banking c'è una decisione documentata.

### Fase 7 — Evoluzioni (da decidere più avanti)
- Sincronizzazione tra dispositivi passando dal cloud dell'utente: merge dei record per `updatedAt` e `deletedAt`, già previsto dal modello dati.
- Multi-valuta con conversione verso la valuta principale.
- Pubblicazione sul Play Store tramite TWA.
- Spazi condivisi (coppia o famiglia): richiederebbe un backend con dati sul server. A quel punto si rivalutano D1 su Cloudflare o Neon.
- Open Banking in produzione, se lo studio 6b ha dato esito positivo.

---

## Costi e attività fuori dal codice
- Account Cloudflare (gratuito); progetto Google Cloud e client OAuth "Web application" (gratuito).
- **Google in modalità Testing**: massimo 100 utenti di test, login da rifare ogni 7 giorni. Va bene per l'uso personale iniziale.
- Per aprire l'app ad altri: pubblicazione in Production con verifica del brand (homepage, privacy policy, dominio verificato). Consigliato un dominio proprio (~10–15 €/anno), che è l'unico costo prevedibile ed è rimandabile.
- Studio grafico: gratuito, perché i mockup sono fatti con FigCraft (open source) e versionati nel repository; il costo di un eventuale designer esterno è a parte.
- Open Banking: costo da definire nello studio 6b.

## Rischi
- **Safari/iOS** può cancellare lo storage dei siti non installati dopo 7 giorni di inattività. Per questo l'installazione come PWA va suggerita durante l'onboarding, insieme a `storage.persist()` e al backup automatico.
- Niente esecuzione in background affidabile sui telefoni: il backup gira ad app aperta (vedi Fase 3).
- Formati di export diversi per ogni banca: si mitiga con la mappatura delle colonne e i preset.
- I limiti dei piani gratuiti e le offerte Open Banking vanno riverificati sulle fonti ufficiali prima di decidere: le fonti di terzi del 2026 sono in parte discordanti.

## Verifica (per ogni fase)
- **Unit (Vitest)**: logica in `domain/` (periodi, saldi, budget, generazione ricorrenze), repository Dexie con `fake-indexeddb`, round-trip backup → ripristino, migrazioni di schema, provider Drive con fetch mockato, parser di import su file di esempio anonimizzati di più banche, deduplicazione e regole.
- **E2E (Playwright)**: aggiunta di una spesa in modalità offline (`context.setOffline(true)`), persistenza dopo il reload, flussi di Home, Movimenti e Budget, esportazione e importazione, wizard di import CSV.
- **Design**: confronto visivo tra mockup e implementazione delle schermate chiave, in tema chiaro e scuro, a 360 px e a 430 px.
- **PWA**: audit Lighthouse (installabilità, offline); prova manuale da installata su Android/Chrome e iOS/Safari.
- **Backup reale**: account Google di test. Backup automatico, poi ripristino su un secondo browser o profilo, controllando che i conteggi coincidano.
- La CI deve essere verde e l'anteprima Cloudflare deve funzionare prima di chiudere la fase.
