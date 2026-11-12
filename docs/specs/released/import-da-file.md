# Import da file

> **Stato**: Rilasciata (versione 0.11.0, 2026-11-12)
> **Data**: 2026-11-11
> **Ambito**: Fase 6a. I movimenti si importano dall'estratto conto scaricato dall'home banking (CSV, Excel `.xlsx`, OFX, QIF, CAMT.053): Soldo riconosce le colonne, ricorda come è fatto il file di ogni banca, salta i movimenti già importati, propone di unire quelli già segnati a mano e dà le categorie con regole che imparano dalle correzioni. Su Android il file arriva anche da «Condividi».
> **Spec collegate**: usa il modello di [`released/dati-locali.md`](./dati-locali.md) (`source: 'import'`, `externalId`); i conti e i pagamenti di [`released/conti-pagamenti-trasferimenti.md`](./conti-pagamenti-trasferimenti.md); porta il formato di backup a 4, dopo il 3 di [`released/ricorrenze.md`](./ricorrenze.md).

## Panoramica

Chi paga con la carta ha già tutti i movimenti nell'estratto conto della banca. Segnarli di nuovo a mano è lento, e qualcuno si perde. Con questa spec si scarica l'estratto conto dall'home banking e lo si apre in Soldo, dalle Impostazioni:

1. **File**: si sceglie il file. Soldo ne riconosce il formato.
2. **Conto**: si sceglie il conto in cui vanno i movimenti.
3. **Colonne** (solo CSV ed Excel): Soldo propone quali colonne sono data, descrizione e importo, mostrando un esempio per ognuna. Si correggono se serve. La seconda volta che arriva un file della stessa banca, colonne e conto sono già ricordati e il passo si salta.
4. **Anteprima**: l'elenco dei movimenti con la categoria proposta. Quelli già importati non ci sono; quelli che somigliano a un movimento segnato a mano sono indicati, con «Unisci» già scelto. Si tocca una riga per cambiarne la categoria, e Soldo propone di ricordarlo per i movimenti con la stessa descrizione.
5. **Importa**: i movimenti entrano tutti insieme; un avviso offre «Annulla».

Le uscite sono gli importi negativi (o la colonna «Dare»), le entrate quelli positivi (o «Avere»). I trasferimenti tra i propri conti si riconoscono dopo, a mano: si cambia il tipo dal movimento.

Nessun dato esce dal telefono: il file si legge nel browser.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - lettura di CSV (qualunque separatore, testo UTF-8 o Windows-1252, righe di intestazione e di totale ignorate), Excel `.xlsx` (il primo foglio), OFX e QFX, QIF e CAMT.053;
  - importi all'italiana e all'inglese (`1.234,56`, `1,234.56`, `-12,50`, `12,50-`, `€ 12,50`), date `gg/mm/aaaa`, `gg-mm-aa`, `aaaa-mm-gg`, `gg.mm.aaaa` e le date di Excel;
  - colonne proposte dal nome (Data contabile, Descrizione, Causale, Importo, Dare, Avere, e gli equivalenti inglesi) e dal contenuto; un importo con segno oppure due colonne Dare e Avere; una seconda colonna di descrizione facoltativa;
  - il file di una banca si riconosce dalle sue intestazioni: colonne e conto si ricordano (preset);
  - niente doppioni: ogni riga importata ha un `externalId` che dipende da data, importo e descrizione, così un estratto conto che si sovrappone al precedente porta solo i movimenti nuovi;
  - possibili doppioni: una riga con lo stesso tipo e importo di un movimento segnato a mano nello stesso conto, a 3 giorni di distanza al massimo, si propone di unirla (il movimento a mano resta com'è e prende l'`externalId`);
  - regole «la descrizione contiene X → categoria Y»: si propongono cambiando la categoria nell'anteprima, con la parola chiave già scelta e modificabile; una pagina le elenca, le modifica e le elimina;
  - riga esclusa con un tocco; «Importa N movimenti», poi «Annulla»;
  - su Android, «Condividi» il file dall'app della banca verso Soldo apre l'import con il file già scelto;
  - le regole e i preset viaggiano nei backup.
- **Non-obiettivi**:
  - Excel vecchio (`.xls`) e PDF: si salva l'estratto conto in `.xlsx` o CSV;
  - riconoscere i trasferimenti tra i propri conti, le valute diverse dall'euro, i saldi della banca;
  - imparare le regole dalle correzioni fatte dopo, nella schermata del movimento: le regole nascono nell'anteprima o nella loro pagina;
  - lettura in un Web Worker: un estratto conto di qualche migliaio di righe si legge in pochi millisecondi;
  - Open Banking (Fase 6b).

## Design

### Lettura dei file (`src/import/`, funzioni pure)

- `text.ts`: dai byte al testo. UTF-8, e se non è valido Windows-1252; via il BOM.
- `csv.ts`: righe e celle di un CSV, con le virgolette. Il separatore (`;`, `,`, tab, `|`) è quello che dà lo stesso numero di celle nel maggior numero di righe.
- `zip.ts`, `xml.ts` e `xlsx.ts`: il file `.xlsx` è uno zip. Si leggono l'indice dello zip e i file `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/sharedStrings.xml` e il primo foglio, decompressi con `DecompressionStream('deflate-raw')` (nel browser, nessuna libreria). Le celle diventano testo o numero.
- `ofx.ts`, `qif.ts`, `camt.ts`: i formati con le colonne già note. OFX (1.x SGML e 2.x XML) dai blocchi `STMTTRN` (`DTPOSTED`, `TRNAMT`, `NAME`, `MEMO`); QIF dai record separati da `^` (`D`, `T` o `U`, `P`, `M`); CAMT.053 dagli `Ntry` (`Amt`, `CdtDbtInd`, `BookgDt`, descrizione da `Ustrd`, `Nm` della controparte, `AddtlNtryInf`), con `DOMParser`.
- `values.ts`: `parseAmount(text)` in centesimi interi e `parseDate(text, format)`; `detectDateFormat(values)` sceglie il formato che legge tutte le date, `gg/mm` prima di `mm/gg`.
- `columns.ts`: per una tabella (CSV o Excel) trova la riga di intestazione (quella prima della prima riga con una data e un importo) e propone la mappatura `{ date, description, description2?, amount } | { …, debit, credit }`, prima dal nome della colonna (data contabile prima di data valuta), poi dal contenuto. `signature(header)`: le intestazioni normalizzate, per riconoscere il file la volta dopo.
- In `columns.ts` anche le righe: dalla tabella e dalla mappatura ai movimenti letti, `ImportedRow { line, date, amountCents (con segno), description }` (`types.ts`); le righe senza data o senza importo (totali, saldi) si scartano, e la seconda descrizione si aggiunge solo se dice qualcosa in più («Pagamento POS» accanto a «PAGAMENTO POS ESSELUNGA» no).
- `read.ts`: `readStatement(file)` riconosce il formato da estensione e contenuto e restituisce una tabella da mappare oppure le righe già lette; errori `empty`, `unsupported` (anche `.xls` e PDF), `unreadable`.
- `external-id.ts`: `externalId = 'imp1:' + SHA-256(data | importo | descrizione normalizzata | n)`, dove `n` conta le righe uguali nello stesso file, così due caffè uguali nello stesso giorno restano due.
- `duplicates.ts`: `findPossibleDuplicates(rows, existing)`: per ogni riga, il movimento non importato dello stesso tipo e importo più vicino per data, a 3 giorni al massimo, usato una volta sola.
- `rules.ts`: `matchRule(description, rules)`: vince la regola con la parola chiave più lunga contenuta nella descrizione, senza badare a maiuscole e accenti; `suggestKeyword(description)` toglie le parole di servizio delle banche (pagamento, POS, carta, bonifico, addebito, SDD, del, date, numeri e codici) e propone le prime due parole che restano.

### Dati

- `src/db/schema.ts`: `ImportRule { pattern, kind, categoryId }` e `ImportPreset { signature, mapping, accountId, dateFormat }`, con i campi di `BaseRecord`. `SCHEMA_VERSION` 3.
- `src/db/database.ts`: versione 3 con le tabelle `importRules: 'id'` e `importPresets: 'id, signature'`.
- `src/db/repositories/import.ts`: regole (elenco, salva, elimina con eliminazione logica), preset (trova per firma, salva), `importedExternalIds(ids)`, `duplicateCandidates(from, to)`, `fallbackCategories()` e `commitImport(plan)`, in una sola transazione: aggiunge i movimenti nuovi (`source: 'import'`, nota dalla descrizione, pagamento: il primo del conto se c'è), unisce i doppioni (l'`externalId` sul movimento esistente), salva le regole nuove e il preset. Restituisce cosa serve ad annullare. `undoImport(result)` lo annulla: i movimenti aggiunti spariscono del tutto (così lo stesso file si può importare di nuovo), quelli uniti perdono l'`externalId`, le regole nuove spariscono; il preset resta.
- `src/backup/format.ts`, `version.ts`, `export.ts`, `import.ts`: formato 4 con `importRules` e `importPresets`; un file di formato 3 li riceve vuoti.
- Senza categoria proposta, un'uscita va in «Altro» e un'entrata in «Altre entrate» (le categorie predefinite, o la prima non archiviata dello stesso tipo).

### Interfaccia (`src/features/import/`)

- **Impostazioni**: nuova sezione «Dalla banca», con «Importa estratto conto» (porta all'import) e «Regole delle categorie» (con il loro numero).
- `ImportView.vue`, percorso `/impostazioni/importa` (`SubPage`, `depth: 1`): un passo alla volta, scritto nell'indirizzo (`?passo=conto`, `colonne`, `anteprima`), così «Indietro» e il gesto tornano al passo prima. Un passo aperto senza file (un ricaricamento) riparte dal file. La logica dell'anteprima, funzioni pure, è in `preview.ts`.
  - **File**: spiegazione dei formati e pulsante «Scegli il file». Gli errori di lettura si dicono qui.
  - **Conto**: `ChoiceList` dei conti attivi, il preset o il primo conto di tipo banca già scelto; un tocco sceglie e va avanti.
  - **Colonne**: per data, descrizione, seconda descrizione, importo (oppure Dare e Avere: `SegmentedControl` «Un importo» / «Dare e Avere») una riga con la colonna scelta e il valore della prima riga; toccandola si sceglie la colonna da un foglio. Il formato della data è detto sotto («Date lette come giorno/mese/anno»). «Continua» resta spento finché data, descrizione e importo non leggono almeno una riga.
  - **Anteprima**: un riepilogo («24 movimenti nuovi · 2 da unire · 3 già importati»), «Cambia le colonne» per i fogli, e le righe (`ImportRow.vue`) raggruppate per giorno con `DayGroup`. Toccando una riga si apre `ImportRowSheet.vue`: «Da importare» (`CheckRow`, nuovo in `src/components/`), la griglia delle categorie del suo tipo e, se la categoria cambia, «Ricorda per le descrizioni che contengono», già spuntato, con la parola chiave proposta (si può cambiare o spegnere). «Fatto» applica. Una regola nuova vale subito per le altre righe dell'anteprima che la contengono e che non sono state cambiate a mano. Le righe da unire mostrano il movimento esistente e la scelta «Unisci» / «Importa comunque».
  - `ActionBar` con «Importa N movimenti»; poi si torna a Movimenti e l'avviso «Importati N movimenti» offre «Annulla».
- `ImportRulesView.vue`, percorso `/impostazioni/regole` (`SubPage`, `depth: 1`): le regole, parola chiave e categoria, in ordine alfabetico; toccandone una si apre `ImportRuleSheet.vue` (parola chiave, uscita o entrata, categoria; «Elimina»). Pulsante «Nuova regola». Stato vuoto che spiega come nascono.
- Testi in `src/i18n/locales/it.json` ed `en.json`; i nuovi componenti in `/dev/ui`. Le schermate usano i componenti esistenti (`SubPage`, `ChoiceList`, `BottomSheet`, `CategoryGrid`, `SegmentedControl`, `ActionBar`, `TextField`); gli screenshot vanno in `docs/design/render/` e la descrizione in `docs/design/README.md`, al posto di un mockup.

### Condividi verso Soldo (Android)

- `vite.config.ts`: nel manifest `share_target` con `action: '/api/share-target'`, `method: 'POST'`, `enctype: 'multipart/form-data'` e il file `statement` (tipi CSV, Excel, OFX, QIF, XML, testo). Sotto `/api/`, così senza service worker la richiesta arriva al Worker e non alle pagine statiche.
- `public/share-target.js`, caricato nel service worker con `importScripts` (opzione `workbox.importScripts`), prima delle rotte di Workbox: intercetta il POST, mette il file in Cache Storage (`soldo-share`) e risponde con un redirect a `/impostazioni/importa?condiviso=1`. `ImportView` lo prende con `src/features/import/shared.ts`, lo cancella e parte dal passo Conto.
- Senza service worker (prima installazione) il POST arriva al Worker: `worker/index.ts` risponde con un redirect alla stessa pagina, senza leggere il file, e la pagina dice di condividerlo di nuovo.

### Test

- Unitari per ogni modulo di `src/import/` con file di esempio inventati in `src/import/fixtures/` (CSV di due banche italiane con intestazioni e totali, `.xlsx` costruito nel test, OFX 1 e 2, QIF, CAMT.053); il repository dell'import (doppioni, unione, regole, preset, annulla); la migrazione del database a 3 e un backup di formato 3.
- Componenti: `ImportView` e `ImportRulesView` con `testPlugins()`; la logica dell'anteprima in `preview.test.ts`; `public/share-target.js` e `shared.ts` in `shared.test.ts`.
- e2e in `e2e/import.spec.ts`: un CSV si importa nel conto scelto e i movimenti compaiono in Movimenti; lo stesso file una seconda volta non porta niente di nuovo e salta il passo Colonne; una categoria cambiata nell'anteprima crea la regola, che si ritrova nella sua pagina; «Annulla» toglie l'import; un PDF dice che non si legge; un file condiviso con un POST, come fa Android, passa dal service worker e apre l'import con il file scelto. axe sulle pagine nuove.

## Fasi di rilascio

1. **Lettura dei file**: `src/import/` con i test.
2. **Dati**: tabelle, repository, backup di formato 4.
3. **Interfaccia**: Impostazioni, pagina Importa, anteprima, pagina Regole, e2e.
4. **Condividi** su Android.
5. Verifica finale: `pnpm check` e `pnpm test:e2e` verdi; prova a mano con l'estratto conto vero di una banca, su Android anche da «Condividi».
