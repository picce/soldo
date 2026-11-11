# Aggiunta in meno tocchi

> **Stato**: Rilasciata (versione 0.10.0, 2026-11-11)
> **Data**: 2026-11-11
> **Ambito**: Segnare una spesa richiede meno passaggi: «Uscita» si tocca da ogni scheda, Soldo può aprirsi già sul tastierino, e la nota si scrive nella schermata stessa, con le note più usate a un tocco.
> **Spec collegate**: cambia la schermata di [`released/aggiunta-rapida.md`](./aggiunta-rapida.md); il pulsante compare nelle pagine di [`released/movimenti.md`](./movimenti.md), [`released/budget-mensili.md`](./budget-mensili.md) e [`released/statistiche.md`](./statistiche.md).

## Panoramica

Oggi una spesa con una nota vuole cinque tocchi oltre alle cifre e al testo: tornare in Home (i pulsanti «Uscita» ed «Entrata» sono solo lì), «Uscita», «Nota», «Fatto», la categoria. Tre si possono togliere.

1. **«Uscita» da ogni scheda**: in Movimenti, Budget e Statistiche un pulsante sopra la barra apre la nuova uscita, senza passare dalla Home.
2. **Soldo si apre sul tastierino**: per chi vuole, all'apertura l'app mostra subito la nuova uscita. Apri, importo, categoria.
3. **Nota nella schermata**: toccando «Nota» il campo si apre al posto dei pulsanti, senza foglio e senza «Fatto»; sotto compaiono le note usate più spesso, che si inseriscono con un tocco.

Il salvataggio al tocco della categoria resta com'è.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - pulsante «Uscita» in Movimenti, Budget e Statistiche, con lo stesso segno «−» della Home;
  - impostazione «All'apertura»: Home (di base) oppure Nuova uscita;
  - nota scritta nella schermata dell'aggiunta, anche in modifica e per le serie; le note frequenti dello stesso tipo di movimento (uscite o entrate) si filtrano mentre si scrive;
  - nessun tocco in più per chi non usa la nota.
- **Non-obiettivi**:
  - spese frequenti salvate con un tocco dalla Home: lavoro a parte, se servirà ancora;
  - un pulsante «Salva» nella nuova uscita;
  - suggerire la categoria dalla nota (Fase 6, regole di import);
  - riaprire il tastierino ogni volta che si torna all'app dopo averla lasciata in background: vale solo per l'apertura.

## Design

### Pulsante «Uscita»

- `src/app/components/QuickAddButton.vue` (nuovo): un pulsante a pillola, alto 48 px, pieno in `biro`, con l'icona `minus` e il testo «Uscita»; nome accessibile «Nuova uscita». Porta a `transaction-new` con `uscita`. In Soldo «+» è l'entrata, quindi il pulsante non usa il «+» delle altre app: l'entrata resta a un tocco, nel selettore in alto della schermata.
- Sta in basso a destra, sopra la barra di navigazione; dove c'è una barra di azioni (Budget) sta sopra quella. Gli avvisi salgono sopra il pulsante.
- `src/app/router.ts`: `meta.quickAdd` sulle pagine `transactions`, `budget` e `stats` (dichiarato in `src/env.d.ts`); `src/App.vue` monta il pulsante dove c'è, dentro l'area principale così i lettori di schermo lo trovano con la pagina, e lascia in fondo alla pagina lo spazio perché l'ultima riga non resti sotto. Posizione e avvisi in `src/theme/app.css`.
- La Home tiene i suoi due pulsanti; le Impostazioni e le pagine secondarie non lo hanno.
- Chiudendo la schermata si torna alla scheda da cui si è partiti (è già così: `goBack`).

### Apertura sul tastierino

- `src/app/start.ts` (nuovo): la preferenza in `localStorage` (`soldo.start`: `home` oppure `expense`), come la lingua: è del dispositivo e non viaggia nei backup. `startPage` (reattivo), `setStartPage`, e `openOnStart(router)`.
- `openOnStart`, installato da `src/main.ts` dopo la guardia del primo avvio: alla prima navigazione della sessione, se va alla Home e la preferenza è `expense`, porta a `/nuovo/uscita`. Vale una volta per sessione (`sessionStorage`), così un ricaricamento, per esempio dopo un aggiornamento, non riapre il tastierino. Un indirizzo diverso dalla Home (una scorciatoia, il ritorno da Google) si rispetta.
- La Home resta sotto: chiudendo o salvando ci si arriva.
- **Impostazioni** (`src/features/settings/SettingsView.vue`): sotto la lingua, la sezione «All'apertura» con `SegmentedControl` («Home», «Nuova uscita») e la riga «Con Nuova uscita Soldo si apre sul tastierino: scrivi l'importo e tocca la categoria.».
- Con il blocco con PIN attivo, la schermata di blocco copre anche il tastierino: i tasti di una tastiera fisica vanno solo al PIN (`TransactionEditorView.vue` li ignora mentre l'app è bloccata).

### Nota nella schermata

- `src/features/transactions/NoteField.vue` (nuovo), al posto di `NoteSheet.vue`, che si elimina con i suoi testi:
  - a riposo è il pulsante «Nota» di oggi, con la nota scritta se c'è;
  - toccato, diventa un campo di una riga (massimo 200 caratteri) che prende tutta la riga dei pulsanti: Data e Pagamento tornano quando si esce dal campo;
  - nel campo, una «x» svuota la nota; Invio o un tocco fuori chiudono la tastiera e tengono quello che c'è scritto; spazi doppi e a capo diventano uno spazio;
  - sotto il campo, mentre è attivo, la riga «Note frequenti», sopra l'inizio delle categorie e senza spostarle: fino a 8 note, da scorrere di lato. Un tocco inserisce la nota e chiude la tastiera; poi si tocca la categoria. Mentre si scrive restano le note che contengono quel testo, senza badare a maiuscole e accenti.
- `src/domain/notes.ts` (nuovo, funzioni pure): `frequentNotes(notes, query, limit)`. Le note uguali a meno di maiuscole e accenti contano come una, mostrata com'è stata scritta l'ultima volta; in ordine dalla più usata, a parità dalla più recente.
- `src/db/repositories/transactions.ts`: `listRecentNotes(kind)` legge dall'indice per data, all'indietro, le note degli ultimi 500 movimenti di quel tipo che ne hanno una. Si legge la prima volta che il campo si apre, non all'apertura della schermata.
- `src/features/transactions/TransactionEditorView.vue`: `NoteField` nella riga dei pulsanti; gli altri pulsanti nascosti mentre si scrive la nota.

### Testi, design, test

- Testi in `src/i18n/locales/it.json` ed `en.json`; via quelli del foglio della nota.
- `docs/design/README.md`: «Aggiunta rapida» descrive la nota nella schermata e il pulsante «Uscita» sulle altre schede. Nessun mockup nuovo: il pulsante usa lo stile del pulsante primario, il campo quello dei campi di testo e dei pulsanti piccoli.
- `/dev/ui`: `QuickAddButton` e `NoteField`.
- Unitari: `src/domain/notes.test.ts`, `listRecentNotes` in `src/db/repositories/transactions.test.ts`, `src/app/start.test.ts`, `src/features/transactions/NoteField.test.ts`, la nota in `TransactionEditorView.test.ts`, l'impostazione in `src/features/settings/SettingsView.test.ts`.
- e2e in `e2e/quick-add.spec.ts`: da Movimenti «Uscita» apre il tastierino e chiudendo si torna a Movimenti; con «All'apertura: Nuova uscita» l'app ricaricata in una sessione nuova mostra il tastierino e salvando arriva alla Home; una nota scritta una volta si ritrova tra le frequenti e si inserisce con un tocco.

## Fasi di rilascio

1. **Nota nella schermata**: `notes.ts`, `listRecentNotes`, `NoteField`, schermata e test.
2. **Pulsante «Uscita»** sulle tre schede.
3. **Apertura sul tastierino** e impostazione. Verifica finale: `pnpm check` e `pnpm test:e2e` verdi; prova a mano sul telefono, con la tastiera vera.
