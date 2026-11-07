# Statistiche

> **Stato**: Rilasciata (versione 0.8.0, 2026-11-07)
> **Data**: 2026-11-07
> **Ambito**: Prima parte della Fase 5. La scheda Statistiche, oggi vuota, mostra come cambiano uscite ed entrate nel tempo: un mese giorno per giorno contro il mese prima, un anno mese per mese, l'andamento di una categoria negli ultimi 12 mesi. Ogni numero ha accanto il confronto con il periodo prima, fermo allo stesso punto.
> **Spec collegate**: usa il modello di [`dati-locali.md`](./dati-locali.md); il rendiconto di un periodo resta nella Home ([`home-rendiconto.md`](./home-rendiconto.md)); il selettore del conto viene da [`conti-pagamenti-trasferimenti.md`](./conti-pagamenti-trasferimenti.md); l'elenco filtrato da [`movimenti.md`](./movimenti.md).

## Panoramica

La Home dice quanto è entrato e uscito in un periodo e in quali categorie. Le Statistiche rispondono a un'altra domanda: sto spendendo più o meno del solito, e dove cambia?

Per questo ogni cifra ha accanto il confronto con il periodo prima, ma allo stesso punto: il 7 novembre le uscite del mese si confrontano con quelle dal 1 al 7 ottobre, non con tutto ottobre, che altrimenti sembrerebbe sempre più caro. Un grafico mostra la spesa che cresce giorno per giorno, accanto a quella del mese prima; per l'anno, le barre di entrate e uscite mese per mese. Da una categoria si apre il suo andamento negli ultimi 12 mesi.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - vista **Mese**: uscite con il confronto, entrate, risparmiato, media al giorno; il grafico delle uscite accumulate giorno per giorno, del mese e del mese prima; le categorie con la differenza dal mese prima;
  - vista **Anno**: gli stessi numeri, con la media al mese; le barre di entrate e uscite mese per mese; le categorie con la differenza dall'anno prima;
  - **andamento di una categoria**: barre degli ultimi 12 mesi con la media, il mese scelto rispetto alla media, l'elenco dei mesi e i movimenti;
  - grafici che si leggono con il dito e con la tastiera, con una tabella per gli screen reader e colori controllati per il daltonismo;
  - il selettore del conto, come in Home e Movimenti;
  - stato vuoto che spiega cosa arriverà.
- **Non-obiettivi**:
  - periodo personalizzato: la Home ha giorno, settimana, mese e anno; un intervallo libero si valuta dopo;
  - previsioni, medie mobili, esportazione dei grafici;
  - budget nelle statistiche, che hanno la loro pagina;
  - grafici a torta: la barra per categoria è già nella Home;
  - trasferimenti: non sono né entrate né uscite e non compaiono.

## Design

### Cosa conta

`src/domain/stats.ts` (nuovo), funzioni pure sui movimenti già caricati:

- **Uscite ed entrate**: movimenti non eliminati, senza trasferimenti, del conto scelto se c'è (come `summarize` di `src/domain/summary.ts`, che si riusa).
- **Periodo di confronto**: per un mese il mese prima, per un anno l'anno prima. Se il periodo è quello in corso, il confronto si ferma allo stesso giorno: il 7 novembre contro il 1–7 ottobre, il 31 marzo contro tutto febbraio (il giorno si ferma all'ultimo del mese), il 7 novembre 2026 contro il 1 gennaio–7 novembre 2025. Un periodo passato si confronta per intero.
- **Differenza**: importo e percentuale arrotondata; senza percentuale se il periodo prima è zero («nuova» per una categoria).
- **Media al giorno**: uscite diviso i giorni contati (nel mese in corso fino a oggi compreso, altrimenti tutti). **Media al mese** per l'anno: uscite diviso i mesi contati, allo stesso modo.
- **Risparmiato**: entrate meno uscite, anche negativo.
- **Uscite accumulate**: per ogni giorno del mese la somma delle uscite fino a quel giorno; nel mese in corso la linea si ferma a oggi, quella del mese prima arriva in fondo.
- **Mese per mese**: entrate e uscite di ogni mese dell'anno; i mesi che devono ancora venire restano vuoti.
- **Ultimi 12 mesi di una categoria**: il totale di ogni mese, dal mese scelto indietro di 11; la **media** sui mesi finiti tra questi, senza quelli prima del primo movimento della categoria (così una categoria nuova non ha una media bassa per i mesi in cui non c'era).

### Pagina Statistiche

`src/features/stats/StatsView.vue`, al posto della pagina vuota, su `/statistiche?mese=2026-11` oppure `?anno=2026` (senza niente, il mese di oggi). Il periodo sta nell'indirizzo, così «Indietro» da una categoria torna allo stesso punto.

- **In alto**: il selettore del conto (dal secondo conto, come in Home), poi `PeriodSwitcher` con una nuova prop `units` (di base le quattro della Home): qui solo **Mese** e **Anno**, con titolo e frecce.
- **Scheda «Uscite»**: l'importo grande; sotto la differenza con una freccia, «↗ 12% · +33,50 € rispetto a 1–7 ottobre» (oppure «rispetto a ottobre», «rispetto al 2025, fino al 7 nov»). La differenza non ha colore: spendere di più non è sempre un male, e il verso lo dicono la freccia e il segno. In fondo tre cifre: Entrate (nel colore delle entrate), Risparmiato, Al giorno (o Al mese).
- **Grafico, vista Mese, «Giorno per giorno»**: linea in `--color-chart-expense` per il mese, linea tratteggiata in `--color-ink-2` per il mese prima, asse dei giorni (1, 8, 15, 22, ultimo) e tre o quattro valori in euro; un punto sull'ultimo giorno contato. Legenda sotto.
- **Grafico, vista Anno, «Mese per mese»**: per ogni mese due barre affiancate, entrate in `--color-chart-income` e uscite in `--color-chart-expense`; legenda sotto. Toccato un mese, gli altri si attenuano e accanto alla legenda compare «Apri ottobre», che passa alla vista Mese di quel mese.
- **Per categoria**: le uscite per categoria, dalla più alta, con l'importo e sotto la differenza («↗ 13% · +10,00 €», «nuova», «come prima»); la riga apre l'andamento. Nell'intestazione il confronto in breve («rispetto al 2025»), perché la scheda sopra dice già fino a che giorno. Sotto, se ci sono, le entrate per categoria nello stesso modo.
- **Vuoto**: senza nessun movimento, una frase su cosa arriverà e «Aggiungi una spesa». Con movimenti altrove ma non nel periodo, la scheda mostra zero e il grafico resta vuoto con «Nessuna uscita a novembre».

### Andamento di una categoria

`src/features/stats/CategoryTrendView.vue` su `/statistiche/categoria/:id?mese=2026-10` (per la vista Anno, il mese è dicembre dell'anno, o il mese in corso), `SubPage` con `depth: 1` e `fullscreen`, titolo il nome della categoria.

- Scheda: il mese scelto, il suo totale («finora» se è in corso) e, se il mese è finito, la differenza dalla media (un mese a metà sembrerebbe sempre più economico); sotto «Media al mese» e «Negli ultimi 12 mesi».
- Grafico: 12 barre nel colore della categoria, quella del mese scelto piena e le altre attenuate; la media come linea tratteggiata, con la scritta «media» nel margine destro. Toccare una barra la legge, come negli altri grafici.
- Elenco dei mesi dal più recente, con il totale: è anche la tabella del grafico.
- «Vedi i movimenti di ottobre»: Movimenti filtrato per categoria e mese (`/movimenti?categoria=…&dal=…&al=…`, come dalla Home).

### Grafici

`src/components/LineChart.vue` e `src/components/BarChart.vue` (nuovi), in SVG scritto a mano: niente librerie, l'app resta leggera e offline. Seguono la skill `dataviz`:

- linee di 2 px, barre con gli angoli in alto arrotondati di 3 px e 2 px tra due barre affiancate, griglia in `--color-line`, valori degli assi in `--color-ink-2` e Mono 10; un solo asse dei valori;
- colori per serie: due token nuovi, `--color-chart-expense` e `--color-chart-income`. In chiaro sono `--color-pen` e `--color-income`; in scuro un passo più scuri (`#6b84f2`, `#3aa86d`), perché la luminosità delle barre resti nella fascia che la skill chiede su fondo scuro. Controllati con lo script della skill: separazione per daltonismo ΔE 22 (deuteranopia), sopra la soglia di 8; la tritanopia è sotto (5,3) e per questo c'è sempre la legenda;
- **lettura**: toccare o trascinare sceglie il giorno o il mese più vicino (con il mouse il passaggio legge e il clic fissa la scelta, così «Apri ottobre» resta raggiungibile), con una linea verticale (o le altre barre attenuate) e il valore nella riga del titolo, «5 nov 198,60 € · ott 150,60 €»; con la tastiera il grafico prende il fuoco e le frecce spostano la scelta. La riga del valore è `aria-live="polite"`;
- per gli screen reader il disegno è nascosto e al suo posto c'è una tabella con tutti i valori (nascosta alla vista);
- in `/dev/ui`, in chiaro e in scuro.

### Testi

In `it.json` ed `en.json` un blocco `stats` (viste, scheda, grafici, categorie, vuoto, andamento). Escono i testi di `pages.stats`, che non servono più. L'icona nuova è `chart-line` (vuoto); `arrow-up-right` e `arrow-down-right` in peso Regular per le differenze.

### Test

- Unit:
  - `stats`: confronto allo stesso giorno (anche a fine mese e a cavallo d'anno), periodi passati per intero, differenze con il periodo prima a zero, medie, uscite accumulate, mesi dell'anno, 12 mesi di una categoria con la media senza i mesi prima del primo movimento; trasferimenti esclusi;
  - `LineChart` e `BarChart`: tabella, scelta con le frecce, valore letto;
  - `StatsView`: mese in corso e passato, anno, categoria che apre l'andamento, vuoto; `CategoryTrendView`: media, elenco, movimenti.
- E2E (`e2e/stats.spec.ts`), con l'orologio della pagina fermo: alcune spese in ottobre e novembre; il confronto «rispetto a 1–7 ottobre», la lettura di un giorno toccando il grafico, la vista Anno e «Apri ottobre», l'andamento di una categoria e i suoi movimenti.

## Fasi di rilascio

Un rilascio, la versione 0.8.0, sul branch `feature/statistiche`:

1. **Mockup** in chiaro e in scuro, a 390 e 360 px: Mese con un giorno toccato, Anno con un mese toccato, andamento di una categoria, vuoto. In HTML in `docs/design/mockup-fase-5/`, come per la Fase 4, da riportare in `design/soldo.figcraft` alla prima sessione in locale.
2. **Dominio** con i test.
3. **Grafici** e token.
4. **Pagine**.
5. **Test end-to-end**, confronto con i mockup, chiusura su `develop`.
