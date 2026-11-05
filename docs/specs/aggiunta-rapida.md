# Aggiunta rapida e modifica di un movimento

> **Stato**: Parziale (implementata su `develop` il 2026-11-05; esce con la prossima release)
> **Data**: 2026-11-05
> **Ambito**: Schermata per segnare un'uscita o un'entrata con il minor numero di tocchi (importo, poi categoria), con tastierino calcolatrice, data e nota facoltative; la stessa schermata modifica, duplica ed elimina un movimento. Introduce l'avviso con «Annulla» e la pagina interna `/dev/ui`.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`mockup-fase-2.md`](./mockup-fase-2.md) (modifica, data, nota); usata da [`home-rendiconto.md`](./home-rendiconto.md) e [`movimenti.md`](./movimenti.md)

## Panoramica

È la funzione che si usa ogni giorno, ispirata a Monefy: dalla Home si tocca «Uscita», si scrive l'importo e si tocca la categoria. Il movimento è salvato, senza un pulsante Salva. Il mockup approvato è [Nuova uscita](../design/render/nuova-uscita-chiaro.png); le regole sono in [docs/design](../design/README.md), sezione «Aggiunta rapida».

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - nuova uscita o entrata in tre gesti: «Uscita», cifre, categoria;
  - tastierino con le quattro operazioni, risultato calcolato mentre si scrive, al massimo due decimali;
  - data (di base oggi) e nota facoltative, ognuna in un foglio dal basso;
  - modifica di un movimento esistente dalla stessa schermata, con «Salva», «Duplica» ed «Elimina» (in Movimenti le ultime due si fanno anche scorrendo la riga, vedi [`movimenti.md`](./movimenti.md));
  - avviso «Salvato: −12,40 € · Spesa» al ritorno; eliminazione e duplicazione con «Annulla»;
  - funziona offline; vibrazione breve sui tasti dove il dispositivo la supporta (Android);
  - scorciatoia «Nuova uscita» nel manifest (tenendo premuta l'icona dell'app);
  - pagina interna `/dev/ui`, solo in sviluppo, con i componenti in chiaro e in scuro.
- **Non-obiettivi**:
  - scelta del conto: con un solo conto (Contanti) il pulsante non compare; arriva con la Fase 4;
  - trasferimenti e ricorrenze (Fase 4);
  - suggerimenti di categoria in base alla nota (Fase 6, regole di import).

## Design

### Percorsi

In `src/app/router.ts`:

- `/nuovo/:kind(uscita|entrata)`, nome `transaction-new`;
- `/movimenti/:id`, nome `transaction-edit`.

Entrambi usano `src/features/transactions/TransactionEditorView.vue` e hanno `meta.fullscreen`: `src/App.vue` nasconde la barra di navigazione. Chiudi torna indietro nella cronologia, o alla Home se la schermata è stata aperta direttamente.

### Comportamento

- **Nuovo movimento**: toccare una categoria salva, se l'importo è maggiore di zero. Con importo zero l'importo vibra (animazione breve, disattivata con `prefers-reduced-motion`) e compare l'indicazione «Scrivi prima l'importo»; con un calcolo che dà zero, un numero negativo o più di 999.999.999,99 compare «Importo non valido». L'indicazione sparisce al tasto successivo.
- **Modifica**: la categoria attuale è evidenziata con il bordo `--color-pen`; toccarne un'altra la seleziona senza salvare. «Salva» salva; «Duplica» crea una copia di quello che è sullo schermo con la data di oggi, lasciando l'originale com'era; il cestino in alto elimina. Dopo «Duplica» ed «Elimina» si torna indietro con l'avviso e «Annulla». Il primo tasto numerico sostituisce l'importo salvato; un operatore o la cancellazione lo modificano.
- **Importo sullo schermo**: finché non c'è un'operazione si vede il numero come lo si scrive (`12,5`); con un'operazione sopra compare il calcolo («8,9 + 3,5») e sotto il risultato con due decimali. Il simbolo € va dove lo mette la lingua (`12,40 €`, `€12.40`).
- **Tastiera fisica**: cifre, virgola o punto, `+ - * /` e Backspace funzionano come i tasti, tranne quando un foglio è aperto.
- **Uscita/Entrata**: il selettore in alto cambia il tipo e la griglia mostra le categorie di quel tipo.
- **Calcolatrice**: `src/domain/calculator.ts` (nuovo, funzioni pure): stato con l'espressione, tasti cifre, virgola, `+ − × ÷` e cancella; × e ÷ prima di + e −, come sulla calcolatrice del telefono; calcolo esatto (frazioni) e arrotondamento solo del risultato, al centesimo, metà in su (10 ÷ 3 × 3 fa 10,00); massimo 9 cifre intere e 2 decimali; un'operazione dopo un'altra sostituisce la precedente; divisione per zero lascia l'importo invariato. Il risultato si calcola a ogni tasto, quindi non serve il tasto =.

### Componenti

- `src/components/Keypad.vue` (nuovo): griglia 4×4 come nel mockup, tasti alti 58 px, emette il tasto premuto; `navigator.vibrate(10)` se disponibile.
- `src/components/CategoryGrid.vue` (nuovo): griglia di 4 colonne con icona nel colore della categoria e nome; prop `selectedId` per la modifica.
- `src/components/AmountText.vue` (nuovo): importo formattato con `formatAmount` (dati-locali), in Mono, con il segno e la variante grande.
- `src/components/ActionChip.vue` (nuovo): i pulsanti piccoli Data e Nota (36 px, icona e testo).
- `src/components/BottomSheet.vue` (nuovo): foglio dal basso basato su `VvDialog` (CSS `vv-dialog` in `src/theme/volver.css`), per data, nota e filtri.
- `src/components/SegmentedControl.vue` (esistente): selettore Uscita/Entrata.
- `src/app/components/AppToast.vue` e `src/app/toast.ts` (nuovi): avviso sopra la navigazione come nel mockup di Movimenti, con azione facoltativa e chiusura dopo 5 secondi; uno alla volta, annunciato con `role="status"`. Il conto alla rovescia si ferma finché il dito, il mouse o il focus sono sull'avviso.
- `src/features/transactions/DateSheet.vue` e `NoteSheet.vue` (nuovi): i fogli Data e Nota dei mockup. «Oggi» e «Ieri» scelgono e chiudono; «Altra data» usa il campo data del browser. La nota ha al massimo 200 caratteri, va a capo con un solo spazio e Invio equivale a «Fatto».
- `src/features/transactions/useTransactionEditor.ts` (nuovo): stato della schermata, caricamento in modifica, salvataggio tramite i repository.

Icone da aggiungere in `scripts/build-icons.js`: `x`, `calendar-blank`, `note-pencil`, `backspace`, `trash`, `copy`, `check` (quelle delle categorie predefinite ci sono già; `minus` e `plus` arrivano con la Home).

Funzioni di supporto: `useIntlLocale()` in `src/i18n/locale.ts`, `formatDate()` in `src/domain/dates.ts`, `currencyPlacement()` in `src/domain/money.ts`, il token `--color-scrim` (velo sotto i fogli) in `src/theme/tokens.css`.

### Dati iniziali

Finché non c'è l'onboarding ([`onboarding.md`](./onboarding.md)), `src/main.ts` chiama `seedDefaults()` all'avvio, caricato a parte perché il codice del database non pesi sul primo caricamento.

### Manifest

`vite.config.ts`: `shortcuts` con «Nuova uscita» (`/nuovo/uscita`) e la sua icona.

### Pagina `/dev/ui`

`src/features/dev/DevUiView.vue` (nuovo), registrata in `src/app/router.ts` solo con `import.meta.env.DEV`: mostra i componenti dell'app uno sotto l'altro, ognuno in chiaro e in un riquadro `theme theme--dark`. Ogni spec che aggiunge un componente lo aggiunge qui. I titoli sono i nomi dei componenti, non testi dell'interfaccia.

### Testi

`src/i18n/locales/it.json` ed `en.json`: titoli, tasti con nome accessibile (le cifre si leggono da sole; operatori, virgola e cancella hanno un nome: «Diviso», «Virgola», «Cancella»…), indicazioni, avvisi.

### Test

- `src/domain/calculator.test.ts`: cifre e virgola, limiti, operazioni in sequenza, arrotondamenti, cancella, divisione per zero.
- `src/components/Keypad.test.ts`, `src/components/CategoryGrid.test.ts`, `src/app/toast.test.ts`.
- `src/test/plugins.ts` (nuovo): i plugin per montare i componenti nei test (vue-i18n e Volver con le icone locali, senza le quali `VvIcon` le cercherebbe in rete).
- `src/features/transactions/TransactionEditorView.test.ts`: salvataggio al tocco della categoria, importo zero, modifica ed eliminazione.
- `e2e/quick-add.spec.ts` (nuovo): con la rete spenta si aggiunge un'uscita, si ricarica la pagina e il movimento c'è ancora; si modifica e si elimina con «Annulla».

## Fasi di rilascio

1. **Calcolatrice e componenti**, con `/dev/ui` e i test unitari.
2. **Nuovo movimento**: salvataggio, avviso, scorciatoia nel manifest, e2e offline.
3. **Modifica ed eliminazione**, dopo l'approvazione dei mockup di [`mockup-fase-2.md`](./mockup-fase-2.md).
