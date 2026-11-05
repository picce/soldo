# Schermate della Fase 2

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Disegna in FigCraft le schermate della Fase 2 che i mockup del nucleo non coprono: modifica di un movimento, scelta della data e della nota, filtro per categoria, Impostazioni complete, gestione delle categorie, importazione di un backup.
> **Spec collegate**: serve a [`aggiunta-rapida.md`](./aggiunta-rapida.md), [`movimenti.md`](./movimenti.md), [`gestione-categorie.md`](./gestione-categorie.md), [`backup-manuale.md`](./backup-manuale.md), [`onboarding.md`](./onboarding.md)

## Panoramica

I mockup approvati il 2026-11-05 coprono Home, Nuova uscita, Movimenti, Onboarding e gli stati vuoti. La roadmap prevede che le schermate di ogni fase si disegnino all'inizio della fase, con lo stesso sistema. Per la Fase 2 mancano le schermate secondarie: senza, le spec che le usano dovrebbero inventare l'aspetto in codice.

## Obiettivi e non-obiettivi

- **Obiettivi**: le schermate qui sotto, in chiaro e in scuro, nello stesso file e con le stesse variabili, stili di testo e icone; screenshot in `docs/design/render/`; componenti nuovi descritti in `docs/design/README.md`.
- **Non-obiettivi**: schermate di Fase 3 e successive (backup su Drive, conti, budget, statistiche); ridisegnare le schermate già approvate, salvo ritocchi che emergono qui.

## Design

Le schermate si aggiungono alla pagina Schermate di `design/soldo.figcraft`, con script incrementali (`figcraft-cli run --in`), mai rigenerando il file: l'utente può averlo modificato nell'app.

| Schermata | Contenuto |
|---|---|
| Modifica movimento | La Nuova uscita in modalità modifica: titolo «Modifica», categoria attuale evidenziata, pulsante «Salva», «Duplica» ed «Elimina» |
| Riga scorsa | Una riga di Movimenti scorsa verso sinistra (Elimina) e una verso destra (Duplica), prima e dopo la soglia, e l'avviso «Duplicato» con «Annulla» |
| Data | Foglio dal basso con «Oggi», «Ieri» e un campo data |
| Nota | Foglio dal basso con un campo di testo su più righe e «Fatto» |
| Filtro categoria | Foglio dal basso con l'elenco delle categorie da spuntare, «Tutte» e «Applica» |
| Impostazioni | Lingua, Categorie (riga che apre la gestione), Backup (esporta, esporta CSV, importa, data dell'ultimo backup), Informazioni (versione) |
| Categorie | Selettore Uscite/Entrate, elenco con icona, colore e maniglia per il riordino, sezione «Archiviate» chiusa, «Nuova categoria» |
| Modifica categoria | Nome, griglia di icone, otto campioni di colore con il nome, «Archivia» o «Ripristina» |
| Importa backup | Finestra di conferma con l'anteprima (data del file, numero di movimenti e categorie) e l'avviso che i dati attuali vengono sostituiti |
| Installa su Android | Variante della scheda «Installa Soldo» dell'onboarding con il pulsante «Installa» |

**Colore per eliminare.** La palette riserva il rosso a errori e avvisi e non ha ancora un token per le azioni distruttive. Qui si aggiunge il token `errore` (chiaro e scuro, contrasto almeno 4,5:1 col testo sopra), usato sotto la riga scorsa verso sinistra e per i messaggi di errore; la duplicazione usa `biro`.

Tutte in 390×844, con la versione scura come istanza in modo Scuro. Gli screenshot seguono i nomi già in uso (`<schermata>-chiaro.png`, `<schermata>-scuro.png`).

## Fasi di rilascio

1. **Disegno** delle schermate e aggiornamento di `docs/design/README.md`.
2. **Approvazione**: checkpoint con l'utente prima di implementare le schermate nelle altre spec.
