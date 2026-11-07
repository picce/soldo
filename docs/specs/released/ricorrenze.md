# Ricorrenze

> **Stato**: Rilasciata (versione 0.6.0, 2026-11-07)
> **Data**: 2026-11-07
> **Ambito**: Ultima parte della Fase 4. Un movimento si può segnare come ricorrente (ogni giorno, settimana, mese o anno, con intervallo e fine facoltativi): Soldo lo aggiunge da solo quando arriva il giorno, senza doppioni. Una pagina elenca le ricorrenze e i prossimi addebiti; da lì una serie si modifica, si interrompe e si riprende.
> **Spec collegate**: usa il modello di [`dati-locali.md`](./dati-locali.md); estende [`aggiunta-rapida.md`](./aggiunta-rapida.md) e [`movimenti.md`](./movimenti.md); usa conti e pagamenti di [`conti-pagamenti-trasferimenti.md`](./conti-pagamenti-trasferimenti.md); condivide il formato di backup 3 con i [budget mensili](./budget-mensili.md).

## Panoramica

Affitto, stipendio e abbonamenti oggi vanno segnati a mano ogni volta. Con questa spec si segnano una volta: nell'aggiunta rapida, il foglio della data ha anche «Ripeti». Da lì in poi, ogni volta che l'app si apre (o torna in primo piano), Soldo aggiunge i movimenti arrivati a scadenza.

Ogni movimento generato ha un id che dipende dalla regola e dal giorno: se c'è già, anche eliminato, non si crea di nuovo. Così due aperture di seguito, due schede o un backup ripristinato non fanno doppioni, e una rata cancellata a mano non ricompare.

Un movimento generato è un movimento come gli altri: entra nei saldi, nel rendiconto e nei budget, e si modifica o si elimina da solo. La serie si cambia dalla pagina Ricorrenze, e le modifiche valgono per i movimenti che devono ancora arrivare.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - «Ripeti» nel foglio della data dell'aggiunta rapida, per uscite, entrate e trasferimenti: ogni giorno, settimana, mese o anno, ogni N, fino a una data facoltativa;
  - generazione delle occorrenze scadute all'avvio e al ritorno in primo piano, con id deterministico, e una notifica con cosa è stato aggiunto;
  - pagina Ricorrenze nelle Impostazioni: in arrivo nei prossimi 30 giorni, serie attive, serie concluse;
  - modifica di una serie con la stessa schermata dell'aggiunta rapida; interrompere, riprendere ed eliminare una serie, con «Annulla»;
  - un movimento generato dice di quale serie fa parte e porta a modificarla;
  - conti, categorie e pagamenti usati da una serie non si possono eliminare, solo archiviare.
- **Non-obiettivi**:
  - rendere ricorrente un movimento già salvato: si crea la serie con «Nuova ricorrenza»;
  - regole come «l'ultimo venerdì del mese» o «il 15 e il 30»;
  - notifiche del telefono, generazione con l'app chiusa (una PWA non può);
  - mostrare nei saldi e nei budget i movimenti che devono ancora arrivare;
  - cambiare con la serie i movimenti già generati.

## Design

### Le date

`src/domain/recurrences.ts` (nuovo), funzioni pure. L'occorrenza numero `k` si calcola sempre dalla data di inizio, non dalla precedente, così il giorno non scivola:

| Frequenza | Occorrenza `k` | Esempio |
|---|---|---|
| `daily` | inizio + `k · interval` giorni | |
| `weekly` | inizio + `k · interval` settimane | stesso giorno della settimana |
| `monthly` | inizio + `k · interval` mesi (`addMonths`) | dal 31 gennaio: 28 o 29 febbraio, 31 marzo |
| `yearly` | inizio + `k · interval` anni (`addYears`) | dal 29 febbraio: 28 febbraio negli anni non bisestili |

- `dueOccurrences(rule, today)`: le date dopo `lastGeneratedDate` (dall'inizio, se manca) fino a oggi e alla data di fine, al massimo 1.000 per volta: una serie giornaliera rimasta ferma a lungo finisce nei giri successivi.
- `nextOccurrences(rule, today, until)`: le prossime date dopo oggi, per «In arrivo».
- `occurrenceId(ruleId, date)`: `<id della regola>:<YYYY-MM-DD>`.
- Una serie è **conclusa** quando non ha più occorrenze dopo oggi.

### Dati

Lo schema del database non cambia: `recurrences` esiste dalla versione 1 e le transazioni hanno già `recurrenceId`, `occurrenceDate` e `source: 'recurring'`. Nel modello del movimento (`Recurrence.template`, `src/db/schema.ts`) si aggiunge `paymentMethodId`, facoltativo, perché una spesa ricorrente ha il suo pagamento. Il formato di backup 3 dei [budget](./budget-mensili.md) lo accetta in `src/backup/format.ts`.

`src/db/repositories/recurrences.ts` (nuovo):

- `listRecurrences()`, `getRecurrence(id)`.
- `createRecurrence({ template, freq, interval, startDate, endDate })`: il modello passa gli stessi controlli di un movimento (`validateKind`, oggi interna a `transactions.ts`, diventa esportata); `interval` intero da 1 a 99; `endDate`, se c'è, non prima di `startDate`.
- `updateRecurrence(id, changes, today)`: cambia modello e calendario. Se cambia il calendario (frequenza, intervallo o inizio), `lastGeneratedDate` passa almeno a oggi: i giorni fino a oggi non si riempiono con il calendario nuovo.
- `stopRecurrence(id, today)`: `endDate` a oggi, solo per una serie già partita (una che deve ancora partire si elimina); restituisce la regola com'era, per «Annulla» (`revertRecurrence`).
- `resumeRecurrence(id, today)`: toglie la fine e porta `lastGeneratedDate` almeno a ieri, così i giorni in cui era ferma non si recuperano.
- `deleteRecurrence(id)` e `restoreRecurrence(id)`: la serie sparisce, i movimenti già generati restano.
- `generateDueOccurrences(today)`: in una sola transazione su `recurrences` e `transactions`, per ogni serie non eliminata calcola le date scadute, legge gli id che esistono già (eliminati compresi) e aggiunge gli altri con i campi del modello, `date` e `occurrenceDate` uguali al giorno, `recurrenceId` e `source: 'recurring'`; poi salva `lastGeneratedDate`. Restituisce i movimenti aggiunti. Due schede insieme non fanno doppioni: IndexedDB esegue una dopo l'altra le transazioni di scrittura sulle stesse tabelle.
- `countRecurrenceUses({ accountId | categoryId | paymentMethodId })`: le serie non eliminate che usano quel conto, categoria o pagamento, nel modello. `deleteAccount`, `deleteCategory` e `deletePaymentMethod` le contano come usi.

### Quando si generano

`src/features/recurrences/start.ts` (nuovo), chiamato da `src/main.ts`:

- all'avvio e quando la pagina torna visibile (`visibilitychange`), perché il giorno può essere cambiato con l'app aperta in background;
- dopo aver salvato o ripreso una serie e dopo un ripristino da backup (`restoreBackup` in `src/backup/import.ts`).

All'avvio e al ritorno in primo piano, se ha aggiunto qualcosa, una notifica: «Aggiunto dalle ricorrenze: Affitto», «Aggiunti dalle ricorrenze: Affitto, Netflix», oltre tre (o con lo stesso nome due volte) «Aggiunti 5 movimenti dalle ricorrenze». Il nome di una serie è la nota del modello, altrimenti la categoria, altrimenti «Trasferimento».

### Nell'aggiunta rapida

- **Foglio della data** (`src/features/transactions/DateSheet.vue`, con `RepeatFields.vue`): sotto Oggi, Ieri e Altra data, la sezione «Ripeti»: «Non si ripete», «Ogni giorno», «Ogni settimana», «Ogni mese», «Ogni anno». Scelta una frequenza compaiono «Ogni N» (un campo numerico con l'unità al plurale) e «Fino al» (una data, facoltativa, «Nessuna fine» se vuota). Il giorno scelto sopra è l'inizio della serie. Senza ripetizione, toccare un giorno chiude il foglio come prima; con una ripetizione il foglio resta aperto e si chiude con «Fatto». Una fine prima dell'inizio non si salva: «La fine viene prima dell'inizio».
- **Pulsante della data**: con una ripetizione l'icona diventa `repeat` e il testo «Oggi · mensile» (`giornaliero` diventa «ogni giorno», poi «settimanale», «mensile», «annuale»). Se i pulsanti non stanno in una riga, vanno a capo invece di accorciarsi.
- **Salvare** una spesa che si ripete crea la serie (`createRecurrence`) e subito dopo genera le occorrenze scadute: se la serie parte da oggi o prima, il movimento compare come sempre. La notifica: «Salvato: −750,00 € · Casa. Si ripete ogni mese.»; se parte più avanti, «Programmato: −750,00 € · Casa, dal 1 dicembre, ogni mese.»
- **`/nuovo/uscita?ripeti=mensile`** apre l'aggiunta rapida con la ripetizione già scelta (`giornaliero`, `settimanale`, `mensile`, `annuale`): ci porta «Nuova ricorrenza».
- **Un movimento generato**, aperto in modifica, ha sotto i pulsanti una riga con `repeat`, «Ogni mese» e «Modifica la serie». Le modifiche valgono solo per lui; il foglio della data qui non ha «Ripeti».

### Modificare una serie

Una serie si modifica nella stessa schermata dell'aggiunta rapida, su `/ricorrenze/:id`. `useTransactionEditor.ts` riceve un terzo tipo di bersaglio, `{ mode: 'rule', id }`:

- importo, categoria, pagamento o conto, nota e tipo come per un movimento; la data è l'inizio della serie, il foglio della data mostra «Ripeti» senza «Non si ripete»;
- sotto i pulsanti, «Le modifiche valgono per i prossimi movimenti: quelli già aggiunti restano come sono.»;
- in basso «Salva» e «Interrompi» (o «Riprendi» per una serie conclusa; una serie che deve ancora partire ha solo «Salva»); in alto il cestino, «Elimina la serie». Interrompere ed eliminare mostrano una notifica con «Annulla»;
- conti, categorie e pagamenti archiviati restano scelti se la serie li usava, come per un movimento in modifica.

### Pagina Ricorrenze

`src/features/recurrences/RecurrencesView.vue` su `/impostazioni/ricorrenze` (`SubPage`, `depth: 1`, `fullscreen`), dalla riga «Movimenti ricorrenti» delle Impostazioni (icona `repeat`, sotto il numero di serie attive), in una sezione «Ricorrenze» dopo «Conti e pagamenti».

- **In arrivo**: le prossime occorrenze dei prossimi 30 giorni, al massimo 10, con giorno, nome, «Ogni mese · Carta» e importo.
- **Attive**: una riga per serie con icona, nome, «Ogni mese · prossimo 1 dic» (o «dal 1 dic» se deve ancora partire) e importo, in ordine di prossima data; apre la serie.
- **Concluse (n)**: sezione chiusa (`ArchivedSection`).
- **Vuoto**: «Affitto, stipendio, abbonamenti: segnali una volta e Soldo li aggiunge da solo quando arriva il giorno.»
- In basso «Nuova ricorrenza».

`src/features/recurrences/describe.ts` (nuovo) scrive la frequenza («Ogni mese», «Ogni 2 settimane», in inglese «Every month», «Every 2 weeks»; «mensile» sul pulsante della data) e il nome di una serie.

### In Movimenti

`TransactionRow.vue`: un movimento con `recurrenceId` ha l'icona `repeat` piccola prima del testo sotto il titolo, con «Ricorrente» per gli screen reader. Duplicare un movimento generato crea un movimento normale, fuori dalla serie.

### Conti, categorie e pagamenti usati

`AccountEditView.vue`, `CategoryEditView.vue` e `PaymentMethodEditView.vue` non mostrano il cestino se una serie li usa e lo dicono: «Usato da una ricorrenza: per toglierlo, archivialo.» Archiviare resta possibile; la serie continua con il conto, la categoria o il pagamento archiviato, come i movimenti già salvati.

### Testi

In `it.json` ed `en.json`: `repeat` (frequenze, pulsante, foglio, plurali), `recurrences` (pagina, righe, notifiche), `editor.rule`, `toast` per «Programmato» e «Si ripete», le note sugli usi in `accountEdit`, `categoryEdit`, `paymentEdit`, `settings.recurrences`.

### Test

- Unit:
  - `recurrences`: le quattro frequenze con intervallo, fine del mese, 29 febbraio, data di fine, limite di 1.000, prossime occorrenze, serie conclusa;
  - repository: generazione senza doppioni (due volte di seguito, un'occorrenza eliminata non torna, due generazioni in parallelo), modifica che non rigenera il passato, interrompi, riprendi senza recupero, elimina e «Annulla», usi che bloccano l'eliminazione di conto, categoria e pagamento;
  - backup: una serie con il pagamento nel giro completo; dopo un ripristino si generano le occorrenze scadute.
- Componenti: `DateSheet` con «Ripeti», `TransactionEditorView` che salva una serie (da oggi e nel futuro) e che modifica una serie, la riga della serie su un movimento generato, `RecurrencesView` (in arrivo, attive, concluse, vuoto).
- E2E (`e2e/recurrences.spec.ts`): un affitto mensile segnato oggi compare subito e, spostando l'orologio della pagina (`page.clock`) al mese dopo, ricompare da solo una volta sola; eliminare un'occorrenza non la fa tornare; interrompere una serie ferma i movimenti; modificare l'importo cambia solo i prossimi.

## Fasi di rilascio

Un rilascio insieme ai budget, la versione 0.6.0, sul branch `feature/ricorrenze`, che parte da `develop` dopo i budget:

1. **Mockup** in chiaro e in scuro, a 390 e 360 px: foglio della data con «Ripeti», aggiunta rapida con una ripetizione, Ricorrenze, una serie in modifica, un movimento generato. In HTML in `docs/design/mockup-fase-4/`, da riportare in `design/soldo.figcraft`.
2. **Date e dati**: dominio, repository, generazione, `paymentMethodId` nel modello, usi negli altri repository, con i test.
3. **Aggiunta rapida e serie**: «Ripeti», salvataggio, modifica di una serie, riga della serie.
4. **Pagina Ricorrenze**, riga in Movimenti, avvio e notifica.
5. **Test end-to-end**, confronto con i mockup, chiusura su `develop`.
