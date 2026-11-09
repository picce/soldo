# Rifiniture della Fase 5

> **Stato**: Parziale (storico lungo e accessibilità fatti; la passata con la skill `de-slopify` resta da fare, perché la skill non è in questo repository)
> **Data**: 2026-11-09
> **Ambito**: Ultima parte della Fase 5: Movimenti veloce anche con uno storico lungo, un controllo di accessibilità delle schermate principali e le correzioni che ne vengono.
> **Spec collegate**: la lista di [`released/movimenti.md`](./released/movimenti.md); la schermata di [`blocco-pin.md`](./blocco-pin.md).

## Panoramica

La roadmap chiude la Fase 5 con tre rifiniture: una lista virtualizzata per lo storico lungo, l'accessibilità e una passata sull'interfaccia con la skill `de-slopify`.

Prima di cambiare la lista l'abbiamo misurata, con la CPU rallentata 4 volte come su un telefono:

| Storico | Movimenti a freddo | Righe disegnate |
|---|---|---|
| 9.000 movimenti in 5 anni (circa 5 al giorno) | 1,8 s | 147 |
| 60.000 movimenti in 5 anni (33 al giorno) | 8,1 s | 986 |

La lista disegnava già 30 giorni alla volta, aggiungendone altri scorrendo: con uno storico normale la pagina resta leggera. Con uno molto fitto due cose pesavano: 30 giorni erano quasi mille righe, e prima di mostrarne una Soldo leggeva dal database tutto lo storico, che serve alla ricerca e ai filtri.

Una virtualizzazione vera (solo le righe visibili nella pagina) non serve: le pagine restano piccole e le righe che si aprono, si chiudono e si trascinano funzionano meglio con una lista normale.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - pagine della lista contate in righe (80), a giorni interi, invece che in giorni;
  - la prima pagina subito, letta dall'indice per data, mentre il resto dello storico arriva;
  - nessuna violazione di axe sulle schermate principali, in chiaro e in scuro; contrasto dei colori almeno AA;
  - la schermata di blocco usabile da tastiera, con il fuoco dentro.
- **Non-obiettivi**:
  - virtualizzare le righe;
  - la passata con `de-slopify`: la skill non c'è nel repository; resta per quando ci sarà.

## Design

### Storico lungo

- `src/db/repositories/transactions.ts`: `listRecentTransactions(query, limit)` legge i movimenti più recenti dall'indice `date` all'indietro, con gli stessi filtri di `listTransactions`, e si ferma dopo `limit`; il giorno più vecchio letto, che potrebbe essere a metà, resta fuori.
- `src/features/transactions/TransactionsView.vue`: due letture, quella recente e quella completa; finché manca la completa si mostra la recente. Con una ricerca o un filtro sulle categorie o sui pagamenti si aspetta la completa, che altrimenti direbbe «Nessun risultato» per un momento. Le pagine sono di 80 righe (`ROWS_PER_PAGE`), a giorni interi.

Con 60.000 movimenti Movimenti si apre a freddo in 0,9 s (da 8,1 s), con 65 righe; finita la lettura completa, scorrendo arrivano le pagine successive.

### Accessibilità

- axe-core 4.10 su benvenuto, aggiunta rapida, Home, Movimenti, Budget, Statistiche, Impostazioni, fogli della cifratura e del blocco, Categorie, Conti e schermata di blocco, in chiaro e in scuro: nessuna violazione. axe non calcola il contrasto sopra la carta a quadretti: calcolato dai token, il più basso è il verde delle entrate su carta chiara, 4,85:1 (AA).
- `src/app/components/LockScreen.vue`: il fuoco entra nella schermata quando compare; il PIN si scrive anche con i tasti numerici e si cancella con Backspace.
- `src/components/PinDots.vue`: «1 cifra su 4», con il plurale giusto per i lettori di schermo.

### Test

- `src/db/repositories/transactions.test.ts`: la lettura recente, a giorni interi e con gli stessi filtri.
- `e2e/lock.spec.ts`: il PIN scritto con la tastiera.

## Fasi di rilascio

1. Storico lungo e accessibilità: fatto, con `pnpm check` e `pnpm test:e2e` verdi.
2. Passata con `de-slopify`, quando la skill sarà disponibile.
