# Sensazione da app nativa: movimento, gesti e risposta al tocco

> **Stato**: Parziale (implementata, in prova sull'anteprima di `develop`)
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
  - **transizioni tra le pagine** con la View Transitions API, dove c'è (Chrome su Android, Safari 18, Firefox 144); altrove il cambio resta immediato:
    - tra le sezioni della navigazione, la vecchia pagina sfuma e la nuova compare con una dissolvenza breve;
    - per le pagine secondarie (Categorie, Modifica categoria), entrata da destra e uscita verso destra con «Indietro»;
    - l'aggiunta rapida e la modifica di un movimento salgono dal basso come una finestra e scendono alla chiusura;
  - **risposta al tocco** su tutto ciò che si tocca:
    - righe, pulsanti, chip, tasti e voci della navigazione cambiano subito al tocco e tornano come prima in un attimo, anche dopo un tocco brevissimo;
    - sul computer, solo dove c'è un mouse, il passaggio del puntatore evidenzia righe e pulsanti;
    - niente selezione del testo né menu del browser tenendo premuto sui controlli;
  - **gesti**:
    - trascinando in basso la testata di un foglio (data, nota, filtri) lo si chiude;
    - scorrendo dal bordo sinistro si torna indietro nelle pagine secondarie e nell'aggiunta rapida, dove il sistema non lo fa già (iPhone con l'app installata);
  - **liste**: in Movimenti una riga eliminata si chiude in altezza e una duplicata o ripristinata si apre;
  - **numeri**: cambiando periodo, entrate, uscite e saldo scorrono verso il nuovo valore invece di cambiare di colpo;
  - **navigazione**: la barretta `biro` della voce attiva scivola da una voce all'altra;
  - animazioni brevi (da 150 a 250 ms) e spente con `prefers-reduced-motion`.
- **Non-obiettivi**:
  - riscrivere l'app in nativo o con Capacitor: la pubblicazione sugli store è la TWA della Fase 7;
  - librerie di animazione: bastano CSS, View Transitions e pointer event;
  - animazioni che rallentano i due tocchi dell'aggiunta rapida: il salvataggio resta immediato;
  - togliere la barra del browser senza installare l'app: non è possibile;
  - gesti che fanno già il sistema: su Android e in Safari si torna indietro col gesto del telefono, e Soldo non lo duplica.

## Design

### Regole del movimento

Nuova sezione «Movimento» in [`docs/design/README.md`](../design/README.md), scritta prima del codice. Nel file di design le animazioni non si disegnano: bastano le regole scritte.

| Token | Valore | Uso |
|---|---|---|
| `--motion-press` | 150 ms | ritorno dallo stato premuto, passaggio del mouse |
| `--motion-quick` | 150 ms | dissolvenza tra le sezioni |
| `--motion-base` | 200 ms | righe che entrano ed escono, fogli che si chiudono, numeri, pagine che si chiudono |
| `--motion-page` | 250 ms | pagine e fogli che entrano, barretta della navigazione |
| `--motion-ease` | `cubic-bezier(0.2, 0, 0, 1)` | ciò che entra o si sposta: parte veloce e si posa piano |
| `--motion-ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | ciò che esce: accelera fino a sparire |

Stati del tocco, ricavati dall'inchiostro così valgono in chiaro e in scuro:

| Token | Valore | Uso |
|---|---|---|
| `--color-hover` | `superficie` con il 5% di `inchiostro` | passaggio del mouse su righe e pulsanti chiari |
| `--color-pressed` | `superficie` con il 10% di `inchiostro` | righe, tasti, chip e pulsanti chiari premuti |
| `--color-pen-hover`, `--color-pen-pressed` | `biro` con il 12% e il 22% di `inchiostro` | pulsanti e filtri pieni in `biro` |

Il tocco cambia lo stato subito (durata zero) e il rilascio torna indietro in `--motion-press`: così anche un tocco brevissimo si vede. I pulsanti grandi (`VvButton`) e le caselle della griglia delle categorie si rimpiccioliscono un poco mentre sono premuti (98% e 96%). Il passaggio del mouse vale solo con `@media (hover: hover)`, perché sul telefono resterebbe acceso dopo il tocco.

I token vanno in `src/theme/tokens.css`; le animazioni delle pagine in un file nuovo, `src/theme/motion.css`, importato da `src/main.ts`.

### Risposta al tocco

- `src/theme/app.css`: su pulsanti, link, `summary` e `label` niente menu del tocco prolungato (`-webkit-touch-callout: none`), niente selezione del testo e niente zoom col doppio tocco (`touch-action: manipulation`); per `VvButton` il rimpicciolimento e i tempi di pressione e rilascio.
- `src/theme/tokens.css`: gli stati `hover` e `active` dei pulsanti Volver (primario, secondario, errore) presi dai token qui sopra; quelli di `hover` dentro `@media (hover: hover)`.
- `src/main.ts`: un ascoltatore `touchstart` passivo sul documento, senza il quale Safari su iPhone non applica `:active`.
- Stati premuto e `hover` nei componenti: `src/components/` (ActionChip, FilterChip, IconButton, Keypad, CategoryGrid, SegmentedControl, PeriodSwitcher, BottomSheet, SearchField, IconPicker, ColorPicker), `src/app/components/` (BottomNav, AppToast), `src/features/settings/SettingsRow.vue`, `src/features/categories/CategoryLink.vue` e `CategoriesView.vue`, `src/features/transactions/` (TransactionRow, DateSheet, CategoryFilterSheet), `src/features/home/CategoryRows.vue`. Le schede che contengono righe (Impostazioni) tagliano lo sfondo premuto sugli angoli.

### Transizioni tra le pagine

- `src/app/router.ts` e il tipo `RouteMeta` in `src/env.d.ts`: due campi nuovi.
  - `depth`: livello della pagina, 0 per le sezioni della navigazione (anche il benvenuto), 1 per Categorie, 2 per Modifica categoria;
  - `modal`: le pagine dell'aggiunta rapida e della modifica di un movimento, che si aprono sopra le altre.
- `src/app/page-transitions.ts` (nuovo):
  - `pageTransition(from, to)` sceglie l'animazione: nessuna al primo caricamento e quando cambia solo la query (filtri di Movimenti, tipo delle categorie); `modal-open` e `modal-close` entrando e uscendo da una pagina `modal`; `push` verso una pagina più profonda, `pop` verso una meno profonda; `fade` tra pagine dello stesso livello;
  - `animatePageChanges(router)`, chiamata da `src/main.ts` come la guardia del primo avvio: in `beforeResolve` scrive il tipo in `data-page-transition` su `<html>` e avvolge il cambio di pagina in `document.startViewTransition`, che finisce quando la nuova pagina è disegnata e lo scorrimento è al suo posto. Non anima con `prefers-reduced-motion`, senza la View Transitions API e quando il sistema ha già animato un ritorno col gesto (`hasUAVisualTransition` dell'evento `popstate`).
- `src/theme/motion.css`, in base a `data-page-transition`:
  - `fade`: la vecchia pagina sfuma in metà di `--motion-quick`, poi la nuova compare in `--motion-quick` salendo di 8 px; nel mezzo si vede la carta (sfondo di `::view-transition`), così le due pagine non si sovrappongono mai;
  - `push`: la nuova entra da destra in `--motion-page`, la vecchia arretra di un quarto; `pop` fa il contrario, con la pagina che esce sopra l'altra;
  - `modal-open`: la nuova sale dal basso in `--motion-page` e la vecchia resta ferma; `modal-close`: la vecchia scende in `--motion-base` con `--motion-ease-exit`;
  - `mix-blend-mode: normal` sulle due immagini, perché la fusione di base del browser schiarisce le parti sovrapposte.
- `src/app/scroll.ts` (nuovo): `whenScrollable(top)` attende che la pagina sia alta abbastanza per tornare alla posizione salvata (le righe arrivano da IndexedDB un attimo dopo), al massimo per mezzo secondo. Prende il posto dell'attesa fissa di 120 ms in `scrollBehavior` di `src/app/router.ts`, e la transizione la aspetta: tornando a Movimenti dalla modifica di un movimento, la lista compare già alla riga di prima, senza salto a metà animazione.
- Barra di navigazione (`src/app/components/BottomNav.vue`): durante `fade` ha un suo `view-transition-name` e non sfuma con la pagina; nelle altre transizioni si muove con la pagina da cui fa parte. Durante `fade` hanno un nome anche l'avviso (`AppToast`) e l'invito ad aggiornare (`ReloadPrompt`), che scivolano al loro posto nella pagina nuova (sopra la barra delle azioni della Home o sopra la navigazione).
- Una pagina che scorre sopra un'altra (`push`, `pop`, finestre) ha sul bordo una linea da 1 px in `linea`, come le schede: niente ombre.

### Barretta della navigazione

In `src/app/components/BottomNav.vue` la barretta `biro` diventa un solo elemento, largo una colonna, spostato con `translate` sulla voce attiva in `--motion-page`. Non c'è quando nessuna voce è attiva.

### Gesti

- `src/app/gestures.ts` (nuovo):
  - `releaseCloses(distance, size, velocity)` decide se un trascinamento chiude o riporta indietro: oltre un quarto della misura, oppure con un colpo veloce (almeno 0,5 px/ms dopo 24 px);
  - `useDragToClose(target, onClose)`: il trascinamento verticale di un foglio con i pointer event e la cattura del puntatore, come `SwipeRow`; espone lo spostamento corrente;
  - `useEdgeSwipeBack(target, onBack)`: un trascinamento che parte entro 24 px dal bordo sinistro sposta la pagina col dito; al rilascio, se `releaseCloses` lo conferma, torna indietro, altrimenti la pagina torna al suo posto. Attivo solo su iPhone con l'app installata (`isIos` e `isStandalone` di `src/app/install.ts`), perché altrove il gesto è del sistema.
- `src/components/BottomSheet.vue`: la testata (maniglia, titolo, Chiudi) si trascina verso il basso; il foglio segue il dito (`transform` sul pannello, che si somma al `translate` dell'apertura di Volver) e al rilascio si chiude scendendo o torna su. Il pulsante Chiudi resta, per chi non usa i gesti.
- `src/components/SubPage.vue` e `src/features/transactions/TransactionEditorView.vue`: `useEdgeSwipeBack` sulla pagina, con il ritorno che già fa «Indietro» o Chiudi.

### Liste

- `src/components/list-motion.ts` (nuovo): `expand` e `collapse` per gli hook di `TransitionGroup`, che aprono e chiudono un elemento in altezza (con margine e opacità) in `--motion-base`. L'altezza è l'unica proprietà non composita animata nell'app: riguarda una riga alla volta e dà alla scheda una chiusura continua, senza salti del bordo.
- `src/features/transactions/DayGroup.vue`: le righe del giorno in un `TransitionGroup` con `expand` e `collapse`.
- `src/features/transactions/TransactionsView.vue`: i giorni in un `TransitionGroup`; la lista ha come `key` i filtri, così una ricerca o un filtro la ridisegnano subito senza animare centinaia di righe; quando lo scorrimento aggiunge altri giorni, quelli nuovi compaiono senza animazione.
- `src/components/SwipeRow.vue`: dopo lo scorrimento verso sinistra la riga resta fuori, sull'azione, mentre si chiude; torna al suo posto solo se dopo un secondo è ancora nella pagina.
- Categorie resta senza `TransitionGroup`: una categoria si archivia dalla sua pagina, quindi la lista non la vede uscire, e durante il riordino il `TransitionGroup` misurerebbe tutte le righe a ogni movimento del dito.

### Numeri

- `src/components/useTweenedNumber.ts` (nuovo): un valore numerico che, quando cambia, scorre dal precedente al nuovo in `--motion-base` con `requestAnimationFrame`; il primo valore e `prefers-reduced-motion` non animano.
- `src/components/AmountText.vue`: nuova prop `animated`, usata dalle tre cifre di `src/features/home/SummaryCard.vue`.

### Test

- Unità:
  - `pageTransition` per ogni coppia di pagine; `animatePageChanges` con un `startViewTransition` finto (tipo scritto su `<html>`, nessuna animazione con il movimento ridotto);
  - `releaseCloses`, `useDragToClose` e `useEdgeSwipeBack` (soglia, colpo veloce, annullamento, bordo);
  - `whenScrollable` (pagina già alta, pagina che cresce, tempo scaduto);
  - `useTweenedNumber` con i fotogrammi finti;
  - `BottomSheet` si chiude trascinando la testata; la barretta di `BottomNav` segue la voce attiva; `SwipeRow` resta fuori dopo l'eliminazione.
- E2E (`e2e/motion.spec.ts`): le transizioni scelte nei percorsi principali (sezioni, Categorie e ritorno, aggiunta rapida); con `reducedMotion: 'reduce'` nessuna transizione; un foglio si chiude trascinandone la testata.
- A mano, su Android e su iPhone, dal browser e da app installata: fluidità (nessun fotogramma perso nel profilo di Chrome), gesti che non litigano con quelli del sistema.

## Fasi di rilascio

Un solo rilascio, in quattro passi sullo stesso branch:

1. **Regole del movimento e risposta al tocco**: il guadagno più grande col lavoro più piccolo.
2. **Transizioni tra le pagine** e barretta della navigazione.
3. **Gesti**: fogli e ritorno dal bordo.
4. **Liste e numeri**.
