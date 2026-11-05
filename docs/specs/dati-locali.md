# Dati locali: database e dominio

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Database IndexedDB con Dexie (schema v1 completo), repository, query reattive, funzioni di dominio per importi, date e periodi, dati iniziali (categorie predefinite e conto Contanti). È la base di tutte le altre spec della Fase 2.
> **Spec collegate**: base di [`aggiunta-rapida.md`](./aggiunta-rapida.md), [`home-rendiconto.md`](./home-rendiconto.md), [`movimenti.md`](./movimenti.md), [`gestione-categorie.md`](./gestione-categorie.md), [`backup-manuale.md`](./backup-manuale.md), [`onboarding.md`](./onboarding.md)

## Panoramica

Soldo è local-first: ogni dato vive in IndexedDB sul dispositivo, l'app funziona offline anche in scrittura e il backup va sul cloud dell'utente. Oggi l'app non salva ancora niente. Questa spec introduce il database con lo schema completo della roadmap (anche le tabelle che serviranno in Fase 4), così le fasi successive non richiedono migrazioni distruttive, e le funzioni pure su importi e periodi che useranno Home, Movimenti e backup.

Non c'è interfaccia: il risultato si verifica con i test.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - schema v1 con `accounts`, `categories`, `transactions`, `budgets`, `recurrences`, `settings`, `meta`;
  - record con `id` UUID generato sul client, `createdAt`, `updatedAt` e `deletedAt` (eliminazione logica);
  - repository per conti, categorie, movimenti e meta, con le date di creazione e modifica gestite in un solo punto;
  - query reattive: le viste si aggiornano da sole quando i dati cambiano, anche da un'altra scheda;
  - importi in centesimi interi e date `YYYY-MM-DD` locali, con formattazione per lingua;
  - periodi giorno, settimana (da lunedì), mese e anno, con spostamento avanti e indietro;
  - dati iniziali: 12 categorie di uscita, 4 di entrata e il conto «Contanti», creati una sola volta;
  - richiesta di storage persistente (`navigator.storage.persist()`), da chiamare all'onboarding.
- **Non-obiettivi**:
  - interfaccia (nelle altre spec);
  - logica di budget, ricorrenze e trasferimenti: le tabelle ci sono, il comportamento arriva in Fase 4;
  - sincronizzazione tra dispositivi (Fase 7): `updatedAt` e `deletedAt` la rendono possibile più avanti.

## Design

### Dipendenze

`dexie` (4.x) e `date-fns` (4.x), in `package.json`.

### Schema

`src/db/schema.ts` (nuovo) definisce i tipi. Tutti i record estendono `BaseRecord`: `id: string`, `createdAt` e `updatedAt` (ISO 8601), `deletedAt: string | null`.

| Tabella | Campi | Indici Dexie |
|---|---|---|
| `accounts` | `name?`, `preset?`, `type` (`cash`, `card`, `bank`, `other`), `icon`, `color` (1…8), `initialBalanceCents`, `currency`, `archived`, `order` | `id, order` |
| `categories` | `kind` (`expense`, `income`), `name?`, `preset?`, `icon`, `color` (1…8), `order`, `archived` | `id, kind, order` |
| `transactions` | `kind` (`expense`, `income`, `transfer`), `amountCents` (intero > 0), `currency`, `date` (`YYYY-MM-DD`), `accountId`, `toAccountId?`, `categoryId` (null per i trasferimenti), `note`, `recurrenceId?`, `occurrenceDate?`, `source` (`manual`, `recurring`, `import`, `bank`), `externalId?` | `id, date, [kind+date], categoryId, accountId, updatedAt, externalId` |
| `budgets` | `month` (`YYYY-MM`), `categoryId` (null = totale), `amountCents`, `repeat` | `id, month, categoryId` |
| `recurrences` | modello del movimento, `freq`, `interval`, `startDate`, `endDate?`, `lastGeneratedDate?` | `id` |
| `settings` | `key`, `value` | `key` |
| `meta` | `key`, `value` (`schemaVersion`, `onboardedAt`, `lastExportAt`) | `key` |

Il segno di un importo dipende da `kind`, mai da `amountCents`. IndexedDB non indicizza booleani né `null`: archiviati ed eliminati si filtrano in memoria, che per l'uso personale (migliaia di righe) basta.

**Nomi delle voci predefinite.** Categorie e conti creati da Soldo hanno `preset` (per esempio `groceries`, `cash`) e nessun `name`: il nome si legge da `src/i18n/locales/*.json` (`presets.categories.groceries`, `presets.accounts.cash`), quindi segue la lingua dell'app. Se l'utente rinomina la voce, `name` prende il nuovo valore e da lì in poi non si traduce più. `src/db/names.ts` espone `displayName(record, t)`.

### Database e repository

- `src/db/database.ts` (nuovo): `class SoldoDatabase extends Dexie`, nome `soldo`, `version(1).stores(...)` come nella tabella; un'istanza unica `db`.
- `src/db/repositories/transactions.ts` (nuovo): `addTransaction`, `updateTransaction`, `deleteTransaction` (imposta `deletedAt`), `restoreTransaction`, `duplicateTransaction(id, date)`, `listTransactions({ from, to, kind?, categoryIds? })`; tutte escludono gli eliminati, salvo `restore`.
- `src/db/repositories/categories.ts`, `accounts.ts`, `meta.ts` (nuovi): letture e scritture equivalenti.
- `src/db/records.ts` (nuovo): `newRecord()` e `touch()` per `id`, `createdAt`, `updatedAt`; l'orologio si può sostituire nei test.
- `src/db/useLiveQuery.ts` (nuovo): composable che trasforma `liveQuery` di Dexie in un `Ref`, con disiscrizione quando lo scope Vue si chiude.
- `src/db/persist.ts` (nuovo): `requestPersistentStorage()`, che restituisce se il browser ha concesso lo storage persistente.

### Dati iniziali

`src/db/seed.ts` (nuovo): `seedDefaults()` crea, in un'unica transazione e solo se non ci sono categorie, le categorie della tabella «Categorie predefinite» di [docs/design](../design/README.md) e il conto `cash`. Entrate: Stipendio (`hand-coins`, colore 7), Rimborsi (`arrow-counter-clockwise`, colore 3), Regali ricevuti (`gift`, colore 5), Altre entrate (`dots-three-outline`, colore 6). Le icone nuove si aggiungono a `scripts/build-icons.js`.

### Dominio

Funzioni pure in `src/domain/`, senza Vue né Dexie:

- `money.ts`: `formatAmount(cents, locale, { sign, currency })` con `Intl.NumberFormat` del locale di `INTL_LOCALES` (`src/i18n/index.ts`), sempre due decimali, segno meno tipografico (`−`); `sign` è `auto`, `always` (il saldo) o `never` (le colonne).
- `dates.ts`: `today()` e conversioni tra `Date` locale e `YYYY-MM-DD`, senza passare da UTC.
- `periods.ts`: `Period` (`unit`: `day`, `week`, `month`, `year`; `anchor`: data), `periodRange(period)` con `from` e `to` inclusi, `shiftPeriod(period, step)`, `periodLabel(period, locale)` («Novembre 2026», un intervallo per la settimana come «3-9 novembre», «2026»; per gli intervalli si usa `Intl.DateTimeFormat.formatRange`). Settimana da lunedì in entrambe le lingue.
- `summary.ts`: `summarize(transactions)` restituisce entrate, uscite, saldo e la ripartizione per categoria (ordinata per importo, con le quote); i trasferimenti non contano.

### Test

- `src/db/database.test.ts`, `src/db/repositories/*.test.ts`, `src/db/seed.test.ts` con `fake-indexeddb` (già in `vitest.config.ts`): eliminazione e ripristino, filtri per periodo e tipo, seed idempotente.
- `src/domain/*.test.ts`: formattazione in `it` ed `en`, segni, periodi a cavallo di mese e anno, settimane da lunedì, cambio dell'ora legale, somme e quote.

## Fasi di rilascio

1. **Schema, repository e seed**, con i test.
2. **Dominio**: importi, date, periodi, riepilogo, con i test.
3. Nessuna pubblicazione a sé: esce insieme alla prima spec con interfaccia ([`aggiunta-rapida.md`](./aggiunta-rapida.md)).
