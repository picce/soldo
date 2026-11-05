# Aggiunta rapida e modifica di un movimento

> **Stato**: Bozza (non implementata)
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

- **Nuovo movimento**: toccare una categoria salva, se l'importo è maggiore di zero. Con importo zero l'importo vibra (animazione breve, disattivata con `prefers-reduced-motion`) e compare l'indicazione «Scrivi prima l'importo».
- **Modifica**: la categoria attuale è evidenziata con il bordo `--color-pen`; toccarne un'altra la seleziona senza salvare. «Salva» in alto salva; «Duplica» crea una copia con la data di oggi; «Elimina» elimina. Dopo «Duplica» ed «Elimina» si torna indietro con l'avviso e «Annulla».
- **Uscita/Entrata**: il selettore in alto cambia il tipo e la griglia mostra le categorie di quel tipo.
- **Calcolatrice**: `src/domain/calculator.ts` (nuovo, funzione pura): stato con l'espressione, tasti cifre, virgola, `+ − × ÷` e cancella; calcolo in centesimi con arrotondamento al centesimo (metà in su); massimo 9 cifre intere; un'operazione dopo un'altra sostituisce la precedente; divisione per zero lascia l'importo invariato. Il risultato è sempre un importo valido, quindi non serve il tasto =.

### Componenti

- `src/components/Keypad.vue` (nuovo): griglia 4×4 come nel mockup, tasti alti 58 px, emette il tasto premuto; `navigator.vibrate(10)` se disponibile.
- `src/components/CategoryGrid.vue` (nuovo): griglia di 4 colonne con icona nel colore della categoria e nome; prop `selectedId` per la modifica.
- `src/components/AmountText.vue` (nuovo): importo formattato con `formatAmount` (dati-locali), in Mono, con il segno e la variante grande.
- `src/components/ActionChip.vue` (nuovo): i pulsanti piccoli Data e Nota (36 px, icona e testo).
- `src/components/BottomSheet.vue` (nuovo): foglio dal basso basato su `VvDialog` (CSS `vv-dialog` in `src/theme/volver.css`), per data, nota e filtri.
- `src/components/SegmentedControl.vue` (esistente): selettore Uscita/Entrata.
- `src/app/components/AppToast.vue` e `src/app/toast.ts` (nuovi): avviso sopra la navigazione come nel mockup di Movimenti, con azione facoltativa e chiusura dopo 5 secondi; uno alla volta, annunciato con `role="status"`.
- `src/features/transactions/useTransactionEditor.ts` (nuovo): stato della schermata, caricamento in modifica, salvataggio tramite i repository.

Icone da aggiungere in `scripts/build-icons.js`: `x`, `calendar-blank`, `note-pencil`, `backspace`, `minus`, `plus`, `trash` e quelle delle categorie predefinite.

### Manifest

`vite.config.ts`: `shortcuts` con «Nuova uscita» (`/nuovo/uscita`) e la sua icona.

### Pagina `/dev/ui`

`src/features/dev/DevUiView.vue` (nuovo), registrata in `src/app/router.ts` solo con `import.meta.env.DEV`: mostra i componenti dell'app uno sotto l'altro, ognuno in chiaro e in un riquadro `theme theme--dark`. Ogni spec che aggiunge un componente lo aggiunge qui.

### Testi

`src/i18n/locales/it.json` ed `en.json`: titoli, tasti con nome accessibile («Sette», «Diviso», «Cancella»…), indicazioni, avvisi.

### Test

- `src/domain/calculator.test.ts`: cifre e virgola, limiti, operazioni in sequenza, arrotondamenti, cancella, divisione per zero.
- `src/components/Keypad.test.ts`, `src/components/CategoryGrid.test.ts`.
- `src/features/transactions/TransactionEditorView.test.ts`: salvataggio al tocco della categoria, importo zero, modifica ed eliminazione.
- `e2e/quick-add.spec.ts` (nuovo): con la rete spenta si aggiunge un'uscita, si ricarica la pagina e il movimento c'è ancora; si modifica e si elimina con «Annulla».

## Fasi di rilascio

1. **Calcolatrice e componenti**, con `/dev/ui` e i test unitari.
2. **Nuovo movimento**: salvataggio, avviso, scorciatoia nel manifest, e2e offline.
3. **Modifica ed eliminazione**, dopo l'approvazione dei mockup di [`mockup-fase-2.md`](./mockup-fase-2.md).
