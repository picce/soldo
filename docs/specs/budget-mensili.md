# Budget mensili

> **Stato**: Su `develop`, da provare sull'anteprima e da pubblicare con la versione 0.6.0
> **Data**: 2026-11-07
> **Ambito**: Seconda parte della Fase 4. La pagina Budget, oggi vuota, mostra per ogni mese il budget totale e quelli per categoria, quanto è stato speso e quanto resta. Un budget vale per un solo mese o si ripete ogni mese; salvando una spesa, un avviso dice quando un budget arriva all'80% o lo supera.
> **Spec collegate**: usa il modello di [`dati-locali.md`](./released/dati-locali.md) e il formato di [`backup-manuale.md`](./released/backup-manuale.md); riprende le soluzioni di [`conti-pagamenti-trasferimenti.md`](./released/conti-pagamenti-trasferimenti.md) (saldo iniziale, elenchi, «Annulla»). Le [ricorrenze](./ricorrenze.md) aggiungono spese che il budget conta come le altre.

## Panoramica

La scheda Budget della barra in basso è vuota dalla Fase 0. Con questa spec si decide quanto spendere in un mese, in totale o per categoria, e la pagina dice a che punto si è: speso, budget, quanto resta e, nel mese in corso, quanto si può spendere al giorno fino alla fine.

Un budget di solito è lo stesso tutti i mesi, quindi di base si ripete; si può anche fissarne uno per un mese solo (dicembre con i regali) senza toccare gli altri. Tra i mesi si va con le frecce, come per i periodi della Home.

L'avviso arriva dove lo si vede: nella notifica «Salvato» della spesa che fa passare un budget all'80% o oltre il 100%. Solo nell'app, niente notifiche del telefono.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - pagina Budget con il mese, le frecce, la scheda del budget totale e l'elenco dei budget per categoria, ognuno con speso, budget, barra e quanto resta;
  - nel mese in corso, i giorni che mancano e quanto resta al giorno;
  - una riga con le spese delle categorie senza budget;
  - impostare, cambiare e togliere un budget, totale o di una categoria di uscita, per un mese o da quel mese in poi, con «Annulla»;
  - avviso all'80% e oltre il 100%, una volta sola per soglia, salvando, modificando o duplicando una spesa;
  - stato vuoto che spiega a cosa serve e porta a impostare il primo budget.
- **Non-obiettivi**:
  - budget per conto o per tipo di pagamento: il budget conta le spese di tutti i conti;
  - budget per le entrate, o su periodi diversi dal mese;
  - riporto nel mese dopo di quanto avanzato o sforato;
  - notifiche del telefono, budget nella Home;
  - spese previste ma non ancora fatte (le prossime ricorrenze): il budget conta solo i movimenti che ci sono.

## Design

### Cosa conta

`src/domain/budgets.ts` (nuovo), funzioni pure:

- **Speso** di un mese: le uscite non eliminate con data dentro il mese, compresi i giorni che devono ancora venire. Entrate e trasferimenti non contano. Per categoria e in totale.
- **Budget in vigore** per un mese `M` e una chiave (una categoria, oppure `null` per il totale): tra i budget non eliminati di quella chiave con `month ≤ M`, quello con il mese più recente tra quelli che valgono per `M`. Un budget vale per `M` se è proprio di `M`, oppure se si ripete e non è finito prima (`endMonth` assente o `≥ M`).
- **Stato**: quanto resta (budget meno speso, anche negativo) e la quota usata. Tre livelli: sotto l'80%, dall'80% al 100% compreso, oltre il 100%.
- **Soglia passata**: confrontando lo speso prima e dopo un salvataggio, `near` se passa l'80% senza superare il budget, `over` se lo supera; altrimenti niente. Così l'avviso compare una volta per soglia e non a ogni spesa successiva.
- **Al giorno**: nel mese in corso, quanto resta diviso i giorni da oggi alla fine del mese, oggi compreso; niente se non resta nulla.

### Dati

Lo schema del database non cambia: la tabella `budgets` esiste dalla versione 1 (`month`, `categoryId`, `amountCents`, `repeat`). Si aggiunge un campo facoltativo, senza indice:

```ts
// src/db/schema.ts, Budget
/** Last month of a repeating budget, `YYYY-MM`. Without it, it repeats until another one replaces it. */
endMonth?: string
```

`src/db/repositories/budgets.ts` (nuovo):

- `listBudgets()`: i budget non eliminati.
- `setBudget({ month, categoryId, amountCents, repeat })`: crea o aggiorna il budget di quel mese e di quella chiave; un budget che si ripete riparte senza `endMonth`. L'importo è un intero positivo di centesimi (`isValidAmountCents`).
- `removeBudget(month, categoryId)`: toglie il budget da quel mese in poi. Elimina quello del mese, se c'è, e chiude a `month − 1` i budget più vecchi che si ripetono e varrebbero ancora; i mesi prima non cambiano. Restituisce i budget com'erano prima, per «Annulla» (`restoreBudgets`).

Esempi, con un budget di gennaio che si ripete:

| Azione | Gennaio, febbraio | Marzo | Aprile in poi |
|---|---|---|---|
| Solo marzo a 300 € | budget di gennaio | 300 € | budget di gennaio |
| Da marzo a 300 € | budget di gennaio | 300 € | 300 € |
| Togli da marzo | budget di gennaio | nessuno | nessuno |

Un budget di una categoria eliminata non si mostra; uno di una categoria archiviata sì, finché non lo si toglie.

**Backup**: `BACKUP_FORMAT` passa a 3, perché una versione vecchia dell'app scarterebbe `endMonth` senza dire nulla e i budget tolti tornerebbero a ripetersi. In `src/backup/format.ts` il budget accetta `endMonth`; `src/backup/import.ts` legge i file di formato 2 così come sono e quelli di formato 1 passando dal 2. Una versione vecchia rifiuta il formato 3 con il messaggio che già c'è (`newerFormat`). Le [ricorrenze](./ricorrenze.md) usano lo stesso formato 3, perché escono nella stessa versione.

### Pagina Budget

`src/features/budgets/BudgetView.vue`, al posto della pagina vuota, su `/budget?mese=2026-11` (senza `mese`, il mese di oggi). Il mese sta nell'indirizzo, così «Indietro» da un budget torna allo stesso mese.

- **Mese**: `PeriodSwitcher` con una nuova prop `showTabs` (di base `true`): qui `false`, solo titolo e frecce.
- **Budget del mese**: scheda con la quota usata in alto a destra, «Spesi 680,00 € di 1.000,00 €», la barra, a destra «Restano 320,00 €» oppure «Oltre di 12,40 €», e nel mese in corso «Mancano 24 giorni: 13,33 € al giorno». Senza budget totale, al suo posto il totale speso e «Imposta il budget del mese».
- **Per categoria**: una scheda con una riga per ogni categoria con budget (icona e colore della categoria, nome, «120,40 € di 200,00 €», quanto resta a destra, barra sotto), nell'ordine delle categorie. In fondo, in grigio, «Senza budget: 234,50 €» con le spese delle altre categorie.
- **Barra** (`src/components/BudgetMeter.vue`): riempimento in `biro` sotto l'80%, in `avviso` (nuovo token `--color-warning`, solo per gli stati) dall'80% e in `pericolo` oltre il budget, quando la barra resta piena. Il binario è un passo più chiaro dello stesso colore, come chiede la skill `dataviz`. Accanto, dall'80%, la percentuale con un'icona in peso Regular (`warning`, `warning-circle`), perché a quella misura il Light non si legge (`src/features/budgets/BudgetFlag.vue`). I colori dicono il livello, ma lo dice anche il testo («Restano», «Oltre di»): il colore non è mai l'unica informazione. `role="meter"` con valore, minimo, massimo e un testo letto dagli screen reader.
- **«Aggiungi budget»** nella barra in basso: apre un foglio (`ChoiceList`) con «Budget del mese», se manca, e le categorie di uscita attive senza budget nel mese; la scelta apre il budget.
- **Vuoto**: senza nessun budget nel mese, una frase su a cosa serve e «Imposta un budget».
- Il selettore del conto qui non c'è: il budget conta tutti i conti.

### Un budget

`src/features/budgets/BudgetEditView.vue`, su `/budget/:categoria?mese=2026-11` (`categoria` è l'id oppure `totale`), `SubPage` con `depth: 1` e `fullscreen`.

- Titolo «Budget del mese» o «Budget: Spesa», sotto il mese.
- **Importo al mese**: `TextField` numerico letto con `parseAmount`, come il saldo iniziale dei conti.
- **Ogni mese / Solo novembre**: `SegmentedControl`, di base «Ogni mese». Sotto, cosa succede: «Da novembre 2026 in poi, finché non lo cambi» oppure «Solo per novembre 2026».
- **Spesi finora** nel mese, per scegliere l'importo con il dato davanti.
- In basso «Togli» (solo se nel mese c'è un budget) e «Salva». Togliere mostra «Budget di Spesa tolto da novembre» con «Annulla».

### Avvisi

`src/features/budgets/warnings.ts` (nuovo): `withBudgetCheck(transaction, write)` legge lo speso del mese della data del movimento prima e dopo la scrittura e restituisce la soglia passata più importante. Conta di più `over` di `near`, e a pari livello la categoria del totale.

Il testo si aggiunge a quello della notifica, che resta aperta 8 secondi invece di 5:

- «Salvato: −12,40 € · Spesa. Budget di Spesa: 82% usato.»
- «Salvato: −12,40 € · Spesa. Budget di Spesa superato di 7,30 €.»
- «Budget del mese: 85% usato.», «Budget del mese superato di 40,00 €.»

Lo usano `useTransactionEditor.ts` (spesa nuova, modificata o duplicata) e la duplicazione con lo scorrimento in `TransactionsView.vue`. `notices.ts` riceve il testo in più.

### Testi

In `it.json` ed `en.json`: `budgets` (pagina, scheda, righe, foglio, vuoto), `budgetEdit`, `budgetMeter`, `budgetWarning`. Restano i testi di `pages.budget`, che non servono più: si tolgono.

### Test

- Unit:
  - `budgets`: budget in vigore con ripetizione, mese singolo e fine; speso con entrate, trasferimenti, eliminati e giorni futuri; soglie (sotto, 80%, esattamente 100%, oltre, salto diretto oltre il 100%); quanto resta al giorno;
  - repository: `setBudget` che aggiorna invece di duplicare, `removeBudget` sui tre casi della tabella e «Annulla»;
  - backup: `endMonth` nel giro completo, un file di formato 2 si legge, il formato 3 di una versione nuova è rifiutato da una vecchia.
- Componenti: `BudgetView` (scheda, righe, senza budget, mese in corso e mese passato, vuoto), `BudgetEditView` (nuovo, ripetuto, mese singolo, togli e «Annulla»), `BudgetMeter`, notifica con l'avviso in `TransactionEditorView`.
- E2E (`e2e/budgets.spec.ts`): impostare il budget totale e quello di una categoria, vedere quanto resta dopo una spesa, l'avviso all'80% e oltre il 100%, il mese dopo con il budget ripetuto, un mese singolo, togliere un budget.
- `BudgetMeter` va anche in `/dev/ui`, in chiaro e in scuro.

## Fasi di rilascio

Un rilascio insieme alle ricorrenze, la versione 0.6.0, sul branch `feature/budget-mensili`:

1. **Mockup** in chiaro e in scuro, a 390 e 360 px: Budget con budget, Budget vuoto, un budget, foglio «Aggiungi budget», notifica con l'avviso. Come per la 0.5.0 si disegnano in HTML in `docs/design/mockup-fase-4/` e vanno riportati in `design/soldo.figcraft` alla prima sessione in locale.
2. **Dati**: dominio, repository, `endMonth` e formato di backup 3, con i test.
3. **Pagine**: Budget e un budget, `BudgetMeter`, `PeriodSwitcher` senza schede (`showTabs`).
4. **Avvisi** nell'editor e in Movimenti.
5. **Test end-to-end**, confronto con i mockup, chiusura su `develop`.
