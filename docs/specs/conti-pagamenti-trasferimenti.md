# Conti, pagamenti e trasferimenti

> **Stato**: Bozza
> **Data**: 2026-11-06
> **Ambito**: Prima parte della Fase 4. Dalle Impostazioni si gestiscono i conti, ognuno con il suo saldo, e i tipi di pagamento (Carta, Contanti, Satispay, Bonifico…), ognuno legato a un conto. Una spesa dice come è stata pagata e da lì si ricava il conto. Un trasferimento sposta soldi tra due conti senza contare come entrata o uscita. Home e Movimenti si possono guardare per un solo conto.
> **Spec collegate**: usa il modello di [`dati-locali.md`](./released/dati-locali.md) e il formato di [`backup-manuale.md`](./released/backup-manuale.md); estende [`aggiunta-rapida.md`](./released/aggiunta-rapida.md), [`home-rendiconto.md`](./released/home-rendiconto.md) e [`movimenti.md`](./released/movimenti.md); riprende le soluzioni di [`gestione-categorie.md`](./released/gestione-categorie.md). Le ricorrenze della Fase 4 dipendono da questa spec, il budget no.

## Panoramica

Oggi Soldo ha un solo conto, «Contanti», e ogni movimento finisce lì. Chi paga con la carta e preleva al bancomat non può vedere quanto ha in banca e quanto nel portafoglio, un prelievo si può segnare solo come una spesa finta, e di una spesa non resta scritto come è stata pagata.

Il conto dice da dove escono i soldi, il pagamento dice come hai pagato, e non sono la stessa cosa: Carta e Bonifico di solito escono dalla stessa banca. Per questo sono due elenchi collegati: ogni tipo di pagamento è legato a un conto. Scegliendo «Carta» la spesa va sul conto «Banca», quindi nell'aggiunta rapida la scelta da fare resta una sola, e di base è già pronta: l'ultimo pagamento usato.

I conti si aggiungono con un saldo iniziale e il saldo attuale si calcola dai movimenti. Il prelievo diventa un trasferimento da «Banca» a «Contanti»: i saldi dei due conti cambiano, il rendiconto no.

Chi usa un solo conto vede una cosa nuova sola: il pulsante del pagamento sulle uscite, che non aggiunge tocchi. Selettore del conto, scelta del conto sulle entrate e trasferimenti compaiono dal secondo conto attivo in poi.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - riga «Conti» nelle Impostazioni, con il numero di conti attivi, che apre l'elenco;
  - elenco dei conti con icona, colore, nome e saldo attuale, il totale dei conti attivi, il riordino e una sezione chiusa con gli archiviati;
  - nuovo conto e modifica: nome, icona, colore, saldo iniziale (anche negativo);
  - riga «Tipi di pagamento» nelle Impostazioni, con elenco, riordino e archiviati;
  - nuovo tipo di pagamento e modifica: nome, icona, conto collegato;
  - cinque tipi di partenza: Contanti, Carta, Satispay, Bonifico, Altro, tutti sul conto predefinito finché non si cambia;
  - archiviazione di conti e pagamenti: spariscono dalle scelte ma restano nei movimenti; si possono ripristinare;
  - eliminazione solo per conti e pagamenti mai usati; l'ultimo conto attivo e l'ultimo pagamento attivo non si possono né archiviare né eliminare;
  - sulle uscite, scelta del pagamento, nuove e in modifica, che parte dall'ultimo usato; sulle entrate, scelta del conto;
  - pagamento nella riga di Movimenti, filtro per pagamento, ricerca, colonna nel CSV;
  - trasferimenti: creazione, modifica, duplicazione, eliminazione con «Annulla», riga dedicata in Movimenti, colonna del conto completa nel CSV;
  - selettore del conto in Home e in Movimenti, con «Tutti i conti».
- **Non-obiettivi**:
  - pagamento su entrate e trasferimenti;
  - assegnare un pagamento alle spese già inserite: restano senza, e si può aggiungere modificandole una a una;
  - statistiche per pagamento e per conto (Fase 5);
  - più valute: `currency` resta `EUR` (Fase 7);
  - commissioni sui trasferimenti: si segnano come una normale uscita;
  - trasformare un trasferimento in uscita o entrata, e viceversa: si elimina e si rifà;
  - saldo del conto nella Home: il «Saldo» del rendiconto è entrate meno uscite del periodo, e due saldi diversi sulla stessa pagina si confonderebbero.

## Design

### Saldo

`src/domain/balances.ts` (nuovo), funzione pura:

```
saldo = saldo iniziale + entrate − uscite − trasferimenti in uscita + trasferimenti in entrata
```

- Si contano i movimenti non eliminati con data fino a oggi: una spesa datata la settimana prossima pesa sul saldo da quel giorno.
- Il risultato può essere negativo. Gli importi restano centesimi interi.
- Il calcolo legge tutti i movimenti, quindi parte solo dove il saldo si vede: elenco dei conti e foglio del selettore. La riga delle Impostazioni mostra solo il numero di conti.

### Dati

`accounts`, `toAccountId` e il tipo `transfer` esistono dalla versione 1 dello schema. I pagamenti invece sono nuovi, ed è il primo cambio di schema da quando l'app è pubblicata.

**Schema** (`src/db/schema.ts`, `src/db/database.ts`), `SCHEMA_VERSION` passa a 2:

```ts
export const PAYMENT_PRESETS = ['cash', 'card', 'satispay', 'bankTransfer', 'other'] as const

export interface PaymentMethod extends BaseRecord {
  /** Name chosen by the user. Without it, the name is the translation of `preset`. */
  name?: string
  preset?: PaymentPreset
  icon: string
  /** Account the expenses paid this way are charged to. */
  accountId: string
  order: number
  archived: boolean
}

// Transaction
/** Expenses only. Older expenses have none. */
paymentMethodId?: string
```

- `version(2)` aggiunge `paymentMethods: 'id, order'`. La tabella dei movimenti non cambia: il filtro per pagamento lavora in memoria, come quello per categoria.
- **Aggiornamento**: per chi ha già dei dati, la `upgrade` crea i cinque pagamenti legati al primo conto attivo e aggiorna `meta.schemaVersion`. Non tocca i movimenti. Su un database nuovo la `upgrade` non parte: li crea `seedDefaults`.
- **Due schede aperte**: la scheda con la versione vecchia deve cedere il database all'aggiornamento senza errori. Va provato, perché finora non è mai successo.

**Backup** (`src/backup/`), `BACKUP_FORMAT` passa a 2:

- `format.ts`: la tabella `paymentMethods` e `paymentMethodId` sui movimenti. Zod scarta i campi che non conosce, quindi senza questo un ripristino perderebbe i pagamenti senza dire niente.
- `import.ts`: `readBackup` aggiorna i file di formato 1 prima di controllarli, aggiungendo i cinque pagamenti legati al primo conto attivo del file. Il checksum di Drive si controlla prima, sul testo originale, come oggi.
- `export.ts` e `restoreBackup`: la nuova tabella.
- Una versione vecchia dell'app rifiuta il formato 2 con il messaggio già previsto (`newerFormat`) e non perde dati.
- `csv.ts`: colonna «Pagamento» dopo il conto.

`src/db/repositories/accounts.ts`, sullo stesso schema di `categories.ts`:

- `listAccounts({ includeArchived })`, `getAccount`;
- `createAccount`, `updateAccount` (come per le categorie, un nome uguale alla traduzione lascia «Contanti» legato alla lingua), `reorderAccounts`;
- `archiveAccount`, `unarchiveAccount`, `deleteAccount`, `restoreAccount`;
- `countAccountTransactions`: conta anche i trasferimenti verso il conto. `toAccountId` non ha un indice e per un'operazione rara non serve: si scorre la tabella;
- errori con un nome: `AccountInUseError` e `LastAccountError`. L'ultimo conto va protetto perché senza un conto non si può salvare un movimento;
- archiviando o eliminando un conto, i pagamenti collegati passano al conto predefinito, nella stessa transazione. L'avviso lo dice e «Annulla» li riporta com'erano.

Il **conto predefinito** resta il primo dell'elenco (`getDefaultAccount`): niente campo nuovo, si cambia riordinando. Il primo dell'elenco lo dichiara con la scritta «Predefinito».

Il campo `type` è obbligatorio ma non cambia nulla nell'app, quindi non si chiede: si deduce dall'icona (`wallet` → `cash`, `credit-card` → `card`, `bank` → `bank`, le altre → `other`).

`src/db/repositories/payment-methods.ts` (nuovo), con le stesse operazioni e `PaymentMethodInUseError`, `LastPaymentMethodError`. In più `lastUsedPaymentMethod(accountId?)`: scorre i movimenti da quello aggiornato più di recente (indice `updatedAt`) e si ferma alla prima uscita non eliminata con un pagamento attivo, del conto indicato se c'è. Non serve salvare niente in più. Modificare una vecchia spesa conta come usare il suo pagamento.

`src/db/repositories/transactions.ts`:

- `TransactionQuery.accountId`: i movimenti del conto, compresi i trasferimenti da e verso quel conto;
- `validate` rifiuta un trasferimento senza `toAccountId`, con i due conti uguali o con una categoria; un'uscita o un'entrata con `toAccountId`; un pagamento su un movimento che non è un'uscita.

**Il conto di una spesa non segue il pagamento nel tempo**: se Carta passa da «Banca» a «Banca 2», le spese già fatte restano su «Banca» e i saldi passati non cambiano. Solo scegliendo di nuovo il pagamento su una spesa il suo conto si aggiorna.

### Conti e pagamenti nelle Impostazioni

- Percorsi in `src/app/router.ts`, tutti `fullscreen` e con `SubPage`: `/impostazioni/conti` (`accounts`, `depth: 1`), `/impostazioni/conti/:id` (`account-edit`, con `nuovo`, `depth: 2`), `/impostazioni/pagamenti` (`payment-methods`, `depth: 1`), `/impostazioni/pagamenti/:id` (`payment-method-edit`, con `nuovo`, `depth: 2`).
- `src/features/accounts/AccountsView.vue`: scheda del totale, elenco, sezione `<details>` «Archiviati (n)», «Nuovo conto» nella barra in basso.
- `src/features/accounts/AccountEditView.vue`: nome (obbligatorio, al massimo 24 caratteri, unico senza distinguere maiuscole e accenti), icona, colore, saldo iniziale, «Archivia» o «Ripristina», «Salva». Il cestino compare solo per i conti mai usati, come per le categorie, e «Vedi movimenti» apre Movimenti su quel conto.
- **Saldo iniziale**: `TextField` numerico più un controllo «In attivo / In rosso». Il segno sta a parte perché il tastierino numerico dell'iPhone non ha il meno. Il testo si legge con una nuova `parseAmount` in `src/domain/money.ts`, che accetta `1.234,56` e `1234.56`. `isValidAmountCents` non serve qui: rifiuta zero e i negativi, che per un saldo vanno bene.
- `src/features/payments/PaymentMethodsView.vue` e `PaymentMethodEditView.vue`: stessa struttura, con nome, icona e conto collegato. Il conto si sceglie con `AccountSheet` e la riga si vede con almeno due conti attivi. Nell'elenco, sotto il nome, c'è il conto, se ha un nome diverso dal pagamento: niente «Contanti / Contanti».
- **Icone**: `src/features/accounts/icons.ts` con `wallet`, `credit-card`, `bank`, `piggy-bank`, `coins`, `vault`; `src/features/payments/icons.ts` con `wallet`, `credit-card`, `device-mobile`, `bank`, `money`, `dots-three-outline`. Nomi accessibili in `accountIcons` e `paymentIcons`. `IconPicker` e `ColorPicker` si riusano così come sono. In `scripts/build-icons.js` si aggiungono `credit-card`, `bank`, `coins`, `vault`, `money` e `arrows-left-right`. Niente loghi di Satispay o di altri marchi.
- **Riordino**: `useCategoryOrder` diventa generico (`useRowOrder`) e riceve la funzione che salva l'ordine e il testo da annunciare. Le categorie non cambiano comportamento.

### Selettore del conto

- `src/stores/account-filter.ts` (nuovo): il conto scelto, oppure `null` per «Tutti i conti». Come il periodo della Home vive in memoria, e al riavvio si riparte da tutti i conti. Lo stesso valore vale per Home e Movimenti, così si legge lo stesso conto passando dall'una all'altra e il collegamento da una categoria della Home non deve aggiungere niente.
- `src/components/AccountSelector.vue` (nuovo), nello slot `#actions` di `AppPage`: si vede con almeno due conti attivi, o con un conto già scelto. Apre un foglio con «Tutti i conti», i conti attivi con il saldo e, in fondo, «Gestisci i conti».
- Nella Home lo stesso slot ospita il pulsante «Oggi»: a 360 px devono starci logo, «Oggi» e selettore. Da verificare nei mockup; se non ci stanno, il selettore mostra solo l'icona e il nome accorciato.
- **Conto scelto che sparisce** (eliminato, o un ripristino da backup che non lo contiene): si torna a «Tutti i conti». Un conto archiviato si può guardare da «Vedi movimenti» e resta nel selettore finché è scelto.
- **Movimenti**: la lista passa `accountId` a `listTransactions`; `active`, `listKey` e il ritorno ai primi 30 giorni tengono conto del conto, così lo stato vuoto dice «nessun risultato» e non «nessun movimento».

### Pagamento e conto nell'editor

Il pulsante del conto nel mockup, tra Data e Nota, cambia secondo il tipo di movimento:

| Tipo | Pulsante | Visibile |
|---|---|---|
| Uscita | Pagamento («Carta») | Sempre |
| Entrata | Conto («Banca») | Con almeno due conti attivi, oppure se il movimento sta su un conto archiviato |
| Trasferimento | Nessuno: ci sono «Da» e «A» | |

- **Uscita nuova**: parte da `lastUsedPaymentMethod(contoScelto)`. Se nel selettore non c'è un conto, o quel conto non ha ancora spese con un pagamento, parte dall'ultimo usato in generale; se non ce n'è nessuno, dal primo pagamento dell'elenco. Il tocco sulla categoria salva, come oggi: nessun tocco in più.
- **Foglio del pagamento** (`PaymentMethodSheet.vue`): l'elenco e, con almeno due conti attivi, il conto sotto il nome, con la stessa regola dell'elenco.
- **Il conto dell'uscita** viene dal pagamento. Passando da Uscita a Entrata il pagamento si toglie e il conto resta; tornando a Uscita si riparte dall'ultimo usato.
- **Uscita senza pagamento** (quelle già inserite): il pulsante dice «Pagamento». Si può salvare così, e il conto non cambia.
- **Entrata nuova**: parte dal conto scelto nel selettore, altrimenti dal predefinito. Si sceglie con `AccountSheet.vue`.
- Gli archiviati non si possono scegliere, tranne quello del movimento in modifica: la stessa regola delle categorie.

### Trasferimenti

- `/nuovo/:kind(uscita|entrata|trasferimento)`: `EditorKind` aggiunge `transfer` e il selettore in alto ha un terzo segmento, «Trasferimento», con almeno due conti attivi. In modifica il tipo di un trasferimento non cambia, e un'uscita o un'entrata non può diventare trasferimento.
- **Schermata**: al posto della griglia delle categorie due righe, «Da» e «A», che aprono `AccountSheet`, un pulsante «Scambia» accanto a Data e Nota, e «Salva» sotto le righe (qui non c'è una categoria il cui tocco salva). Di base «Da» è il primo conto e «A» il secondo; il conto scelto in un lato sparisce dalle scelte dell'altro.
- **Riga in Movimenti**: icona `arrows-left-right` in `testo-2`, titolo con la nota o «Trasferimento», sotto «Banca → Contanti», a destra l'importo senza segno in `inchiostro`.
- **Totali**: i trasferimenti restano fuori dal rendiconto, dalle categorie e dal totale del giorno, come già fanno `summarize` e `groupByDay`.

### Movimenti

- **Riga di un'uscita con pagamento**: sotto il titolo «Spesa · Carta». Il conto si ricava dal pagamento e il nome non si ripete; senza pagamento, e sulle entrate, resta «Spesa · Contanti» come oggi.
- **Filtro «Pagamento»** (`?pagamento=id,id`): un foglio come quello delle categorie, in `useTransactionFilters`. Con un pagamento scelto si vedono solo le uscite. Gli archiviati compaiono solo se già scelti.
- **Filtro «Trasferimenti»** (`?tipo=trasferimenti`): visibile con almeno due conti attivi o almeno un trasferimento.
- **Ricerca**: guarda anche il nome del pagamento, e per i trasferimenti i nomi dei due conti. Per le altre righe i conti restano fuori: con «Contanti» come conto predefinito, cercarlo troverebbe tutto.

### Da correggere nel codice che già c'è

Finché esisteva un solo conto e nessun trasferimento non si vedevano, ma con questa spec diventano errori:

| Dove | Oggi | Dopo |
|---|---|---|
| `TransactionsView.vue` | `listAccounts()` esclude gli archiviati: la riga di un conto archiviato perderebbe il nome | `includeArchived: true` |
| `TransactionRow.vue` | L'importo viene da `signedCents`, zero per i trasferimenti: mostrerebbe `0,00` | Per i trasferimenti, `amountCents` senza segno |
| `notices.ts` | Stesso problema: «Salvato: 0,00 €» | «Salvato: 100,00 € · Banca → Contanti» |
| `useTransactionEditor.ts` | Un trasferimento risulta «non trovato», e il salvataggio non scrive `accountId` | Gestisce trasferimenti, pagamento e conto |
| `backup/export.ts` | Il CSV scrive solo il conto di partenza: la destinazione si perde | Colonna del conto «Banca → Contanti» per i trasferimenti |
| `db/repositories/transactions.ts` | `duplicateTransaction` copia una lista fissa di campi | Copia anche `paymentMethodId` |
| `db/seed.ts` | La transazione non comprende i pagamenti | Crea i cinque tipi di partenza |

### Testi

In `it.json` ed `en.json`: `settings.accounts`, `settings.payments`, `accounts`, `accountEdit`, `accountIcons`, `accountSelector`, `payments`, `paymentEdit`, `paymentIcons`, `presets.payments`, `editor.payment`, `editor.transfer`, `transactions.payment`, `transactions.transfers`, `csv.payment`, `toast` per i trasferimenti.

### Test

- Unit:
  - `balances`: entrate, uscite, trasferimenti nei due versi, eliminati, date future, saldo iniziale negativo;
  - `parseAmount`: separatori italiani e inglesi, testo non valido;
  - aggiornamento del database: da un database di versione 1 con movimenti a uno di versione 2, con i cinque pagamenti sul conto giusto e i movimenti intatti; due connessioni aperte;
  - backup: un file di formato 1 si legge e si ripristina con i pagamenti; il giro di formato 2 conserva pagamenti e `paymentMethodId`; il checksum di un file di formato 1 su Drive resta valido;
  - repository dei conti: conto usato anche solo come destinazione, ultimo conto, nome di «Contanti», pagamenti che passano al predefinito e «Annulla»;
  - repository dei pagamenti: ultimo usato con e senza conto, archiviati saltati, ultimo pagamento protetto;
  - `validate` dei movimenti e `listTransactions` per conto;
  - CSV con un pagamento e con un trasferimento;
  - riordino generico: i test delle categorie devono passare senza modifiche.
- Componenti: `AccountsView`, `AccountEditView`, `PaymentMethodsView`, `PaymentMethodEditView`, selettore visibile o no secondo il numero di conti, `TransactionEditorView` con pagamento e trasferimento, `TransactionsView` con un conto archiviato e con il filtro per pagamento.
- E2E (`e2e/accounts.spec.ts`):
  - con un solo conto la spesa si salva con gli stessi tocchi di oggi;
  - pagando con «Carta» la spesa dopo riparte da «Carta»;
  - un pagamento legato a un secondo conto cambia il saldo di quel conto;
  - un trasferimento cambia i due saldi ma non il rendiconto;
  - il filtro per conto in Home e in Movimenti, e quello per pagamento;
  - un conto archiviato resta leggibile nei movimenti;
  - backup e ripristino riportano conti, pagamenti e trasferimenti, anche da un file di formato 1.
- `AccountSelector`, `AccountSheet` e `PaymentMethodSheet` vanno anche in `/dev/ui`, in chiaro e in scuro.

## Fasi di rilascio

Un rilascio, la versione 0.5.0, in sei passi sullo stesso branch `feature/conti-pagamenti-trasferimenti`:

1. **Mockup**, in chiaro e in scuro: Impostazioni, Conti, Modifica conto, Tipi di pagamento, Modifica pagamento, foglio del selettore, foglio del pagamento, Nuovo trasferimento, riga del trasferimento in Movimenti, Home a 360 px con «Oggi» e selettore. Approvati il 2026-11-06, con le immagini in [`docs/design/render/`](../design/render/). Sono disegnati in HTML ([`docs/design/mockup-fase-4/`](../design/mockup-fase-4/)) perché nel cloud FigCraft non si può compilare: **`design/soldo.figcraft` è ancora da allineare**, alla prima sessione in locale.
2. **Dati**: schema 2 con l'aggiornamento, formato di backup 2, saldi, repository, `parseAmount`, correzioni della tabella qui sopra.
3. **Impostazioni**: conti e pagamenti, con riordino e archiviazione.
4. **Editor**: pagamento, conto e trasferimenti.
5. **Selettore** in Home e Movimenti, filtri e riga di Movimenti.
6. **Test end-to-end** e note di rilascio.
