# Gestione delle categorie

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Dalle Impostazioni si creano, rinominano, riordinano e archiviano le categorie di uscita e di entrata, scegliendo icona e colore.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`mockup-fase-2.md`](./mockup-fase-2.md) (Categorie, Modifica categoria)

## Panoramica

Soldo parte con 12 categorie di uscita e 4 di entrata (vedi [`dati-locali.md`](./dati-locali.md)). Ognuno spende in modo diverso: serve poter aggiungere «Palestra», togliere «Animali» dalla griglia senza perdere lo storico, mettere in cima le categorie più usate. L'ordine scelto qui è quello della griglia dell'aggiunta rapida.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - riga «Categorie» nelle Impostazioni, che apre l'elenco;
  - elenco con selettore Uscite/Entrate, icona, colore e nome; categorie archiviate in una sezione chiusa in fondo;
  - riordino trascinando la maniglia, e con i pulsanti «Sposta su» e «Sposta giù» per chi usa la tastiera o un lettore di schermo;
  - nuova categoria e modifica: nome (obbligatorio, al massimo 24 caratteri), icona da una griglia di icone Phosphor scelte per le spese, colore tra gli otto della palette;
  - archiviazione: la categoria sparisce dalla griglia dell'aggiunta rapida ma resta nei movimenti, in Home e in Movimenti; si può ripristinare;
  - eliminazione solo per le categorie mai usate; per le altre si propone l'archiviazione;
  - rinominare una categoria predefinita la stacca dalla traduzione automatica (vedi «Nomi delle voci predefinite» in [`dati-locali.md`](./dati-locali.md)).
- **Non-obiettivi**:
  - sottocategorie;
  - colori fuori dalla palette verificata: gli otto colori sono stati validati per il daltonismo, un colore libero romperebbe la verifica;
  - unione di due categorie (spostare i movimenti dall'una all'altra): da valutare dopo l'uso reale.

## Design

- Percorsi in `src/app/router.ts`: `/impostazioni/categorie` (`categories`) e `/impostazioni/categorie/:id` (`category-edit`, con `nuova` per la creazione).
- `src/features/settings/SettingsView.vue` (esistente): riga «Categorie».
- `src/features/categories/CategoriesView.vue` e `CategoryEditView.vue` (nuovi).
- `src/features/categories/useCategoryOrder.ts` (nuovo): riordino con i pointer event (maniglia, `touch-action: none`) e con i pulsanti; salva l'`order` di tutte le categorie del tipo in una transazione.
- `src/components/IconPicker.vue` e `ColorPicker.vue` (nuovi): griglie di scelta con `role="radiogroup"`; i colori hanno un nome accessibile (Blu, Arancio, Verde acqua, Ocra, Rosa, Verde, Viola, Rosso).
- `src/db/repositories/categories.ts` (da [`dati-locali.md`](./dati-locali.md)): `createCategory`, `renameCategory`, `reorderCategories`, `archiveCategory`, `restoreCategory`, `deleteCategory` (rifiuta se ci sono movimenti).
- Campo nome: `VvInputText` (CSS `vv-input-text` in `src/theme/volver.css`).
- Icone selezionabili: circa 30, aggiunte a `scripts/build-icons.js` (per esempio `barbell`, `book-open`, `baby`, `graduation-cap`, `coffee`, `gas-pump`, `phone`, `wifi-high`, `television`, `game-controller`, `music-notes`, `scissors`, `wrench`, `car`, `bicycle`, `train`, `pill`, `tooth`, `heart`, `bank`, `credit-card`, `coins`, `briefcase`, `house-line`, `tree`, `sun`, `umbrella`, `shopping-bag`, `hamburger`, `wine`).
- Testi in `src/i18n/locales/it.json` ed `en.json`.

### Test

- `src/db/repositories/categories.test.ts`: riordino, archiviazione, eliminazione rifiutata se usata, rinomina di una predefinita.
- `src/features/categories/CategoriesView.test.ts`: riordino con i pulsanti.
- `e2e/categories.spec.ts` (nuovo): nuova categoria «Palestra» compare nella griglia dell'aggiunta rapida; archiviata sparisce dalla griglia e resta nei movimenti.

## Fasi di rilascio

1. **Elenco, creazione e modifica** dopo l'approvazione dei mockup.
2. **Riordino e archiviazione**.
