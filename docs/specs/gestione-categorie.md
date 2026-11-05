# Gestione delle categorie

> **Stato**: Parziale (implementata su `develop` il 2026-11-05; esce con la prossima release)
> **Data**: 2026-11-05
> **Ambito**: Dalle Impostazioni si creano, rinominano, riordinano e archiviano le categorie di uscita e di entrata, scegliendo icona e colore.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`mockup-fase-2.md`](./mockup-fase-2.md) (Categorie, Modifica categoria)

## Panoramica

Soldo parte con 12 categorie di uscita e 4 di entrata (vedi [`dati-locali.md`](./dati-locali.md)). Ognuno spende in modo diverso: serve poter aggiungere «Palestra», togliere «Animali» dalla griglia senza perdere lo storico, mettere in cima le categorie più usate. L'ordine scelto qui è quello della griglia dell'aggiunta rapida.

I mockup approvati sono [Categorie](../design/render/categorie-chiaro.png) e [Modifica categoria](../design/render/modifica-categoria-chiaro.png).

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - riga «Categorie» nelle Impostazioni, con il numero di categorie attive («12 uscite · 4 entrate»), che apre l'elenco;
  - elenco con selettore Uscite/Entrate, icona, colore e nome; categorie archiviate in una sezione chiusa in fondo;
  - riordino trascinando la maniglia, e con i pulsanti «Sposta su» e «Sposta giù» per chi usa la tastiera o un lettore di schermo;
  - nuova categoria e modifica: nome (obbligatorio, al massimo 24 caratteri, diverso da quello delle altre categorie dello stesso tipo), icona da una griglia di 30 icone Phosphor scelte per le spese, colore tra gli otto della palette;
  - archiviazione: la categoria sparisce dalla griglia dell'aggiunta rapida ma resta nei movimenti, in Home e in Movimenti; si può ripristinare;
  - eliminazione solo per le categorie mai usate; per le altre si propone l'archiviazione;
  - rinominare una categoria predefinita la stacca dalla traduzione automatica (vedi «Nomi delle voci predefinite» in [`dati-locali.md`](./dati-locali.md)).
- **Non-obiettivi**:
  - sottocategorie;
  - colori fuori dalla palette verificata: gli otto colori sono stati validati per il daltonismo, un colore libero romperebbe la verifica;
  - unione di due categorie (spostare i movimenti dall'una all'altra): da valutare dopo l'uso reale.

## Design

### Percorsi e schermate

- Percorsi in `src/app/router.ts`: `/impostazioni/categorie` (`categories`) e `/impostazioni/categorie/:id` (`category-edit`, con `nuova` per la creazione). Il tipo sta nella query (`?tipo=entrate`; senza, uscite), così «Indietro» da una categoria di entrata torna sulla scheda Entrate. Le due pagine sono `fullscreen`: niente barra di navigazione, come nei mockup.
- `src/components/SubPage.vue` (nuovo): impaginazione delle pagine aperte da un'altra, con «Indietro», il titolo, uno spazio per le azioni in alto e la barra in basso che resta visibile (come quella della Home). «Indietro» torna alla pagina precedente; se la pagina è stata aperta direttamente va al percorso indicato (`goBack` in `src/app/navigation.ts`, usato anche dall'aggiunta rapida).
- `src/components/IconButton.vue` (nuovo): il pulsante quadrato da 34 px con area tattile di 44 px, prima scritto due volte nell'editor dei movimenti; ora lo usano l'editor e `SubPage`.
- `src/features/settings/SettingsView.vue`: sezione «Categorie» con una riga `SettingsRow.vue` (nuovo: icona, titolo, dettaglio e freccia). Il testo introduttivo provvisorio della pagina è stato tolto, come nel mockup.
- `src/features/categories/CategoriesView.vue`: selettore Uscite/Entrate, elenco in una scheda, sezione `<details>` «Archiviate (n)» chiusa, «Nuova categoria» nella barra in basso. Ogni riga è `CategoryLink.vue` (quadratino del colore, icona, nome, freccia). Le righe sono alte 44 px invece dei 39 del mockup, per l'area tattile.
- `src/features/categories/CategoryEditView.vue`: nome, icona, colore (il nome del colore scelto accanto al titolo), «Archivia» o «Ripristina» e «Salva» in basso. Il cestino in alto compare solo se nessun movimento usa la categoria; altrimenti una nota dice in quanti movimenti è usata e invita ad archiviarla. Archivia ed Elimina mostrano l'avviso con «Annulla»; la creazione mostra «Aggiunta: Palestra».

### Riordino

`src/features/categories/useCategoryOrder.ts`:
- trascinando la maniglia (`touch-action: none`, pointer event catturati) la riga segue il dito, le altre si spostano per farle posto e la pagina scorre quando il dito arriva vicino ai bordi; al rilascio si salva l'ordine e una vibrazione breve segna ogni cambio di posizione;
- «Sposta su» e «Sposta giù» sono pulsanti veri, invisibili finché non ricevono il focus: allora compaiono al posto della maniglia. Dopo lo spostamento il focus resta sul pulsante premuto e un'area `aria-live` legge «Spesa: posizione 2 di 12»;
- l'elenco mostrato cambia subito, il salvataggio avviene dopo; se non riesce l'elenco torna com'era e compare «Non è stato possibile salvare».

### Scelta di nome, icona e colore

- Campo nome: `src/components/TextField.vue` (nuovo), un `<input>` con etichetta, suggerimento ed errore collegati con `aria-describedby`. Al posto di `VvInputText`, che porta con sé la libreria delle maschere e il menu a tendina per un solo campo; anche ricerca e nota usano campi nativi.
- `src/components/IconPicker.vue` e `ColorPicker.vue` (nuovi): griglie di scelta con `role="radiogroup"` e radio nativi nascosti sotto, così le frecce spostano la scelta e i lettori di schermo leggono il nome dell'icona o del colore (Blu, Arancio, Verde acqua, Ocra, Rosa, Verde, Viola, Rosso; nomi in `src/components/palette.ts`).
- Icone in `src/features/categories/icons.ts`: le 24 del mockup più una quinta riga con quelle delle categorie predefinite che mancavano (`t-shirt`, `gift`, `hand-coins`, `briefcase`, `arrow-counter-clockwise`, `dots-three-outline`), così modificando «Vestiti» la sua icona è tra quelle scelte. I nomi accessibili sono in `categoryIcons` nei file delle lingue.
- Una nuova categoria parte dalla prima icona e dal colore meno usati dalle altre del suo tipo (`src/features/categories/suggest.ts`).
- Nome: spazi in eccesso tolti; due categorie dello stesso tipo non possono avere lo stesso nome, senza distinguere maiuscole e accenti.

### Dati

`src/db/repositories/categories.ts`:
- `createCategory` (in fondo alla griglia del suo tipo);
- `updateCategory` (nome, icona, colore; il nome di una predefinita uguale alla traduzione la lascia legata alla lingua);
- `reorderCategories` (in una transazione, scrive solo le righe che si sono spostate);
- `archiveCategory` e `unarchiveCategory` (in fondo, o al posto di prima per «Annulla»);
- `countCategoryTransactions`, `deleteCategory` (rifiuta con `CategoryInUseError` se ci sono movimenti non eliminati) e `restoreCategory` per «Annulla».

Testi in `src/i18n/locales/it.json` ed `en.json` (`settings.categories`, `categories`, `categoryEdit`, `categoryIcons`, `palette`).

### Test

- `src/db/repositories/categories.test.ts`: creazione, rinomina di una predefinita, riordino, archiviazione e ripristino, eliminazione rifiutata se usata.
- `src/features/categories/CategoriesView.test.ts`: riordino con i pulsanti (focus e annuncio), tipo nella URL, sezione Archiviate.
- `src/features/categories/CategoryEditView.test.ts`: creazione, nome obbligatorio e già usato, nome predefinito, eliminazione e archiviazione con «Annulla».
- `src/features/categories/suggest.test.ts`, `src/app/router.test.ts`, `src/features/settings/SettingsView.test.ts`.
- `e2e/categories.spec.ts`: «Palestra» compare nella griglia dell'aggiunta rapida; archiviata, «Animali» sparisce dalla griglia e resta nei movimenti; riordino con i pulsanti e con la maniglia.

## Fasi di rilascio

1. **Elenco, creazione e modifica** dopo l'approvazione dei mockup.
2. **Riordino e archiviazione**.

Le due fasi sono uscite insieme.
