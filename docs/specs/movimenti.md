# Movimenti: elenco, ricerca e filtri

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: La sezione Movimenti elenca tutti i movimenti raggruppati per giorno, con ricerca su note e categorie, filtri per tipo, categoria e periodo, e apre la modifica di un movimento.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md), [`aggiunta-rapida.md`](./aggiunta-rapida.md) (modifica, eliminazione e avviso con «Annulla») e [`mockup-fase-2.md`](./mockup-fase-2.md) (filtro categoria); riceve i filtri da [`home-rendiconto.md`](./home-rendiconto.md)

## Panoramica

I mockup approvati sono [Movimenti](../design/render/movimenti-chiaro.png) e [Ricerca senza risultati](../design/render/movimenti-nessun-risultato-chiaro.png). Oggi la sezione ha solo un testo introduttivo.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - elenco per giorno, dal più recente: etichetta del giorno («Oggi», «Ieri», poi giorno della settimana e data) e totale del giorno;
  - riga: icona nel colore della categoria, nota (o nome della categoria), categoria e conto sotto, importo a destra (entrate in verde con il segno +);
  - ricerca mentre si scrive su note e nomi delle categorie, senza distinguere maiuscole e accenti;
  - filtri Tutti, Uscite, Entrate e Categoria (foglio con le categorie da spuntare);
  - filtro di periodo quando si arriva dalla Home, mostrato come pulsante rimovibile («Novembre 2026 ×»);
  - i filtri stanno nell'URL (`?q=`, `?tipo=`, `?categoria=`, `?dal=`, `?al=`), così il tasto indietro e il ricaricamento li conservano;
  - toccando una riga si apre la modifica; dopo un'eliminazione l'elenco mostra l'avviso con «Annulla»;
  - stati vuoti: nessun movimento in assoluto, nessun risultato.
- **Non-obiettivi**:
  - eliminazione con lo scorrimento della riga: si elimina dalla modifica, come nella spec dell'aggiunta rapida;
  - lista virtualizzata per storici molto lunghi (Fase 5): l'elenco carica un mese alla volta mentre si scorre;
  - filtro per conto (Fase 4).

## Design

- `src/features/transactions/TransactionsView.vue` (esistente, da riscrivere): intestazione, `SearchField`, filtri, elenco.
- `src/features/transactions/useTransactionFilters.ts` (nuovo): legge e scrive i filtri nella query dell'URL.
- `src/domain/search.ts` (nuovo): normalizzazione (minuscole, `NFD` senza segni diacritici) e corrispondenza su nota e nome della categoria (`displayName`, quindi anche nella lingua attiva per le categorie predefinite).
- `src/domain/days.ts` (nuovo): raggruppamento per giorno con i totali.
- `src/components/SearchField.vue` (nuovo): campo di 44 px con lente e «Svuota»; bordo `--color-pen` mentre si scrive.
- `src/components/FilterChip.vue` (nuovo): i filtri da 32 px; attivo pieno in `--color-pen`.
- `src/features/transactions/CategoryFilterSheet.vue` (nuovo): usa `BottomSheet`.
- `src/features/transactions/DayGroup.vue` e `TransactionRow.vue` (nuovi).
- Caricamento: `useLiveQuery` sui movimenti del mese visibile più quelli già caricati; un `IntersectionObserver` in fondo all'elenco aggiunge il mese precedente.
- Testi in `src/i18n/locales/it.json` ed `en.json`; icone `magnifying-glass`, `x`, `caret-down` in `scripts/build-icons.js`.

### Test

- `src/domain/search.test.ts`, `src/domain/days.test.ts`.
- `src/features/transactions/TransactionsView.test.ts`: filtri combinati, stati vuoti.
- `e2e/transactions.spec.ts` (nuovo): ricerca «esselunga» trova «Esselunga»; filtro Entrate; dalla Home una categoria apre l'elenco filtrato; eliminazione e «Annulla».

## Fasi di rilascio

1. **Elenco per giorno** e apertura della modifica.
2. **Ricerca e filtri** nell'URL, con il foglio delle categorie dopo l'approvazione dei mockup.
3. **Caricamento a mesi** e verifica con 2.000 movimenti di prova.
