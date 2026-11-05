# Sensazione da app nativa: movimento, gesti e risposta al tocco

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Transizioni tra le pagine, risposta visibile a ogni tocco (e al passaggio del mouse sul computer), gesti come lo scorrimento per tornare indietro e per chiudere i fogli, liste che si animano quando una riga entra o esce. Soldo deve sembrare un'app del telefono, non un sito.
> **Spec collegate**: rifinisce le schermate di [`aggiunta-rapida.md`](./released/aggiunta-rapida.md), [`home-rendiconto.md`](./released/home-rendiconto.md), [`movimenti.md`](./released/movimenti.md), [`gestione-categorie.md`](./released/gestione-categorie.md) e [`onboarding.md`](./released/onboarding.md); le regole visive restano quelle di [`docs/design`](../design/README.md)

## Panoramica

Dopo la prova sul telefono del 2026-11-05 l'utente scrive: «l'app anche se da browser non sembra assolutamente un'app nativa: non vedo hover, animazioni, swipe o similari».

Cosa c'è oggi:
- si scorre di lato una riga di Movimenti e il periodo della Home;
- i fogli dal basso salgono, gli avvisi entrano, il titolo del periodo scorre, le barre delle categorie cambiano larghezza;
- il tastierino vibra su Android.

Cosa manca, ed è quello che si nota:
- **cambio di pagina**: le pagine cambiano di colpo, senza scorrere né sfumare;
- **risposta al tocco**: un tocco su righe, pulsanti, tasti e voci della navigazione non lascia segno, e sul computer il passaggio del mouse non evidenzia niente (oggi gli stati `:active` sono quattro in tutta l'app);
- **gesti**: non si torna indietro scorrendo dal bordo, non si chiude un foglio trascinandolo in basso;
- **liste**: le righe eliminate o duplicate appaiono e spariscono senza movimento.

Nel browser la barra dell'indirizzo resta: solo l'app installata si apre a schermo intero. Questa spec non può toglierla, ma può far sì che tutto il resto si comporti come in un'app.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - **transizioni tra le pagine** con la View Transitions API, dove c'è (Chrome su Android, Safari 18); altrove il cambio resta immediato:
    - tra le sezioni della navigazione, una dissolvenza breve;
    - per le pagine secondarie (Categorie, Modifica categoria), entrata da destra e uscita verso destra con «Indietro»;
    - l'aggiunta rapida sale dal basso come una finestra e scende alla chiusura;
  - **risposta al tocco** su tutto ciò che si tocca:
    - righe, pulsanti, chip, tasti e voci della navigazione hanno uno stato premuto (sfondo `carta` o leggera riduzione);
    - sul computer, con `@media (hover: hover)`, il passaggio del mouse evidenzia righe e pulsanti;
    - niente selezione del testo né menu del browser tenendo premuto sui controlli;
  - **gesti**:
    - trascinando in basso la maniglia di un foglio (data, nota, filtri) lo si chiude;
    - scorrendo dal bordo sinistro si torna indietro nelle pagine secondarie e nell'aggiunta rapida, dove il sistema non lo fa già (iPhone con l'app installata);
  - **liste**: in Movimenti una riga eliminata si chiude in altezza e una duplicata entra; in Categorie la riga archiviata esce;
  - **numeri**: cambiando periodo, saldo e totali scorrono verso il nuovo valore invece di cambiare di colpo;
  - **navigazione**: la barretta `biro` della voce attiva scivola da una voce all'altra;
  - tutte le animazioni brevi (da 150 a 250 ms), solo con `transform` e `opacity` così non scattano, e spente con `prefers-reduced-motion`.
- **Non-obiettivi**:
  - riscrivere l'app in nativo o con Capacitor: la pubblicazione sugli store è la TWA della Fase 7;
  - librerie di animazione: bastano CSS, View Transitions e pointer event;
  - animazioni che rallentano i due tocchi dell'aggiunta rapida: il salvataggio resta immediato;
  - togliere la barra del browser senza installare l'app: non è possibile.

## Design

Da dettagliare prima di implementare. I punti di partenza nel codice:

- **Movimento in `docs/design/README.md`**: nuova sezione «Movimento» con durate, curve e quali animazioni usano quali elementi, da aggiungere prima del codice. Nel file di design (`design/soldo.figcraft`) le animazioni non si disegnano: bastano le regole scritte.
- **Transizioni tra le pagine**:
  - `src/app/router.ts`: nuovo campo `meta.transition` (`fade`, `push`, `modal`);
  - `src/App.vue`: `document.startViewTransition` attorno al cambio di pagina, con la direzione (avanti o indietro) presa dalla history;
  - `src/theme/app.css`: le animazioni `::view-transition-*`.
- **Risposta al tocco**: stati `:active` e `:hover` in `src/theme/app.css` e nei componenti di `src/components/` (ActionChip, FilterChip, IconButton, Keypad, CategoryGrid, SettingsRow, CategoryLink, TransactionRow); `-webkit-touch-callout: none` e `user-select: none` sui controlli.
- **Gesti**:
  - `src/components/BottomSheet.vue`: trascinamento della maniglia con i pointer event, come `SwipeRow`;
  - `src/components/SubPage.vue` e `src/features/transactions/TransactionEditorView.vue`: scorrimento dal bordo per tornare indietro, con un composable condiviso in `src/app/` sul modello di `useHorizontalSwipe`.
- **Liste**: `TransitionGroup` in `src/features/transactions/DayGroup.vue` e in `src/features/categories/CategoriesView.vue`.
- **Numeri**: `src/components/AmountText.vue` con un'animazione del valore, usata da `src/features/home/SummaryCard.vue`.
- **Navigazione**: `src/app/components/BottomNav.vue`, barretta della voce attiva con `translate`.

### Test

- Unità: il composable dello scorrimento dal bordo e del trascinamento dei fogli (soglie, annullamento), la direzione della transizione nel router.
- E2E: un foglio si chiude trascinandolo in basso; con `reducedMotion: 'reduce'` le pagine cambiano senza animazione.
- A mano, su Android e su iPhone, dal browser e da app installata: fluidità (nessun fotogramma perso nel profilo di Chrome), gesti che non litigano con quelli del sistema.

## Fasi di rilascio

1. **Risposta al tocco e regole del movimento** nel design: il guadagno più grande col lavoro più piccolo.
2. **Transizioni tra le pagine** e barretta della navigazione.
3. **Gesti**: fogli e ritorno dal bordo.
4. **Liste e numeri**.
