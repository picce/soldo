# Home: periodo, rendiconto e barra per categoria

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: La Home mostra il periodo scelto (giorno, settimana, mese, anno), il rendiconto di entrate, uscite e saldo, la barra delle uscite per categoria con le righe di dettaglio, e i pulsanti «Uscita» ed «Entrata».
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`aggiunta-rapida.md`](./aggiunta-rapida.md) (i pulsanti aprono la Nuova uscita); le righe aprono [`movimenti.md`](./movimenti.md) filtrato

## Panoramica

I mockup approvati sono [Home](../design/render/home-chiaro.png) e [Home senza movimenti](../design/render/home-vuota-chiaro.png). Oggi la Home ha solo il logo e un testo introduttivo. Con questa spec diventa la schermata da cui si capisce in un colpo d'occhio com'è andato il periodo.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - schede Giorno, Settimana, Mese, Anno; titolo del periodo con le frecce; scorrimento orizzontale per passare al periodo precedente o successivo;
  - il periodo scelto resta finché l'app è aperta (tornando alla Home non si riparte da oggi); all'avvio è il mese corrente;
  - rendiconto: entrate, uscite, riga in inchiostro e saldo con il segno;
  - barra per categoria come nel mockup: segmenti nei colori delle categorie separati da 2 px, al massimo 7 categorie più «Altre» in `--color-ink-2`;
  - righe per categoria (quadratino, nome, puntini, importo, percentuale); toccandone una si apre Movimenti filtrato per quella categoria e quel periodo;
  - barra delle azioni «− Uscita» e «+ Entrata» fissa sopra la navigazione;
  - stato vuoto come nel mockup;
  - transizione breve tra periodi e larghezze animate della barra, disattivate con `prefers-reduced-motion`.
- **Non-obiettivi**:
  - periodo personalizzato (date libere): proposta di spostarlo in Fase 5 con le statistiche, perché i mockup e l'uso quotidiano non lo richiedono;
  - selettore del conto «Tutti i conti»: arriva con i conti in Fase 4; fino ad allora la Home somma tutto;
  - grafici di andamento (Fase 5).

## Design

- `src/features/home/HomeView.vue` (esistente, da riscrivere): intestazione con `AppLogo`, `PeriodSwitcher`, `SummaryCard`, sezione «Uscite per categoria», barra delle azioni.
- `src/components/PeriodSwitcher.vue` (nuovo): schede (con `role="tablist"`), titolo e frecce da 34 px con area tattile di 44 px; emette il nuovo periodo. Lo scorrimento si riconosce con i pointer event (almeno 60 px in orizzontale e più che in verticale).
- `src/stores/period.ts` (nuovo, Pinia): periodo corrente in memoria.
- `src/features/home/SummaryCard.vue` (nuovo): le due righe con i puntini e il saldo; usa `AmountText`.
- `src/components/CategoryBar.vue` (nuovo): segmenti in `div` con larghezze in percentuale; `role="img"` con `aria-label` che riassume le prime categorie; le righe sotto sono l'equivalente testuale.
- `src/features/home/CategoryRows.vue` (nuovo): righe con collegamento a `/movimenti?categoria=<id>&dal=<from>&al=<to>`.
- `src/domain/summary.ts` (da [`dati-locali.md`](./dati-locali.md)): calcoli; `src/domain/category-share.ts` (nuovo) raggruppa oltre la settima in «Altre» senza cambiare il colore delle altre categorie.
- Testi in `src/i18n/locales/it.json` ed `en.json`; icone `caret-left`, `caret-right`, `minus`, `plus` in `scripts/build-icons.js`.

### Test

- `src/domain/category-share.test.ts`: raggruppamento, percentuali che sommano a 100, colori stabili.
- `src/components/PeriodSwitcher.test.ts`: schede, frecce, etichette in `it` ed `en`.
- `src/features/home/HomeView.test.ts`: dati di prova e stato vuoto.
- `e2e/home.spec.ts` (nuovo): dopo aver aggiunto due uscite e un'entrata, rendiconto e righe mostrano gli importi giusti; il passaggio al mese precedente mostra lo stato vuoto.

## Fasi di rilascio

1. **Periodo e rendiconto**, con i test.
2. **Barra e righe per categoria**, con il collegamento a Movimenti.
3. **Microinterazioni** e confronto visivo con i mockup in chiaro e in scuro, a 360 e 430 px.
