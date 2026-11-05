# Backup manuale ed esportazione CSV

> **Stato**: Parziale (implementata su `develop` il 2026-11-05; esce con la prossima release)
> **Data**: 2026-11-05
> **Ambito**: Dalle Impostazioni si esporta un backup completo in JSON, lo si reimporta (anche su un altro dispositivo) e si esportano i movimenti in CSV per un foglio di calcolo.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`mockup-fase-2.md`](./mockup-fase-2.md) (Impostazioni, Importa backup); usata da [`onboarding.md`](./onboarding.md) («Ripristina un backup»); il formato è la base del backup automatico della Fase 3

## Panoramica

Finché non arriva il backup automatico su Google Drive (Fase 3), i dati stanno solo nel telefono: se si perde il telefono o Safari cancella lo storage, si perde tutto. Il backup manuale è la rete di sicurezza della Fase 2 e definisce il formato che la Fase 3 caricherà su Drive.

I mockup approvati sono [Impostazioni](../design/render/impostazioni-chiaro.png) e [Importa backup](../design/render/importa-backup-chiaro.png).

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - sezione «Backup» nelle Impostazioni con «Esporta backup», «Esporta movimenti» (CSV), «Importa backup» e la data dell'ultimo backup («ultimo: 3 giorni fa», oppure «ultimo: mai»);
  - backup completo in un file JSON versionato, con tutte le tabelle, anche le righe eliminate (servono alla sincronizzazione futura);
  - sul telefono il file si condivide con il foglio di condivisione (`navigator.share` con i file), così si salva in File, Drive o si manda per email; dove non è possibile, si scarica;
  - importazione: scelta del file, validazione, anteprima (nome e data del file, movimenti, categorie, conti), conferma esplicita perché i dati attuali vengono sostituiti;
  - un file non valido o di una versione futura non tocca i dati e mostra un messaggio chiaro;
  - CSV dei movimenti nella convenzione della lingua: in italiano separatore `;` e importi `1234,56`, in inglese `,` e `1234.56`; codifica UTF-8 con BOM perché Excel legga gli accenti.
- **Non-obiettivi**:
  - unione di un backup con i dati presenti (si sostituisce tutto): la Fase 7 porterà il merge tra dispositivi;
  - cifratura del file (Fase 5);
  - importazione da CSV o da file della banca (Fase 6).

## Design

### Formato

`src/backup/format.ts`: schema Zod `backupFileSchema`:

```json
{
  "app": "soldo",
  "format": 1,
  "exportedAt": "2026-11-05T10:00:00.000Z",
  "appVersion": "0.2.0",
  "schemaVersion": 1,
  "data": { "accounts": [], "categories": [], "transactions": [], "budgets": [], "recurrences": [], "settings": [], "meta": [] }
}
```

- Gli schemi dei record sono tipizzati con i tipi di `src/db/schema.ts`; gli elenchi di valori (tipi di movimento, categorie predefinite, frequenze, …) sono diventati array in `schema.ts`, così il file si controlla con gli stessi valori dell'app. Importi in centesimi interi positivi, date `YYYY-MM-DD` reali, colori da 1 a 8.
- Il numero di formato sta in `src/backup/version.ts` (`BACKUP_FORMAT`), separato dagli schemi: l'esportazione non carica Zod. Esiste solo il formato 1: quando cambierà, `readBackup` porterà i file vecchi al formato nuovo prima di controllarli (niente `migrations.ts` finché non serve).

### Esportazione e importazione

- `src/backup/export.ts`: `createBackup()` legge tutte le tabelle in una transazione di sola lettura; `exportBackup()` lo consegna con il nome `soldo-backup-AAAA-MM-GG.json` e salva `meta.lastExportAt`; `exportTransactionsCsv()` fa lo stesso con il CSV (`soldo-movimenti-AAAA-MM-GG.csv`, in inglese `soldo-transactions-…`), che non conta come backup.
- `src/backup/deliver.ts`: `deliverFile(blob, name)` apre il foglio di condivisione sui dispositivi con puntatore grossolano (il dito) che lo permettono, altrimenti scarica il file. Se l'utente chiude il foglio non succede niente (niente avviso, l'ultimo backup non cambia); se il browser rifiuta la condivisione (per esempio perché è passato troppo dal tocco) il file si scarica.
- `src/backup/import.ts`, caricato solo quando si sceglie un file:
  - `readBackup(file)` restituisce l'anteprima o un errore: `notSoldo` (non JSON, un altro file, più di 100 MB), `newerFormat`, `invalid`;
  - `restoreBackup(backup)` svuota e riempie tutte le tabelle in un'unica transazione Dexie, quindi o riesce tutto o non cambia niente. La data del file diventa l'ultimo backup, perché i dati del telefono sono ora quelli del file.
- `src/backup/csv.ts`: `transactionsToCsv(rows, options)`; colonne data, tipo, importo (con segno `-` per le uscite, senza separatore delle migliaia), categoria, conto, nota; dal più vecchio al più recente, senza gli eliminati; virgolette secondo RFC 4180. Un testo che inizia con `=`, `+`, `-` o `@` riceve un apostrofo davanti, così una nota non diventa una formula nel foglio di calcolo.
- `src/features/settings/SettingsView.vue`: sezione Backup con tre righe `SettingsRow` (ora anche pulsante, oltre che link) e «ultimo: …» calcolato con `timeAgo` (`src/domain/dates.ts`, `Intl.RelativeTimeFormat`: «ora», «2 minuti fa», «ieri», «3 giorni fa»).
- `src/features/settings/RestoreBackup.vue`: campo file nascosto (`pick()`), lettura, finestra di conferma con `VvDialog` come nel mockup (anteprima con i puntini, avviso in `errore` con l'icona `warning`, «Annulla» e «Ripristina» pieno in `errore`), avviso finale «Backup ripristinato.». La userà anche l'onboarding.
- Pulsante distruttivo: token `--vv-button-modifier-danger-*` in `src/theme/tokens.css`, con il modificatore `danger` di Volver.
- Testi in `src/i18n/locales/it.json` ed `en.json` (`settings.backup`, `backup`, `csv`); icone `export`, `file-csv`, `file-arrow-up`, `warning` in `scripts/build-icons.js`.

### Test

- `src/backup/import.test.ts`: andata e ritorno esporta e reimporta con dati identici, eliminati compresi; file non JSON, di un'altra app, di formato futuro, con record non validi; transazione annullata se un record non si può scrivere.
- `src/backup/csv.test.ts`: separatori per lingua, virgolette, note con a capo, segni, formule.
- `src/domain/dates.test.ts`: `timeAgo`.
- `e2e/backup.spec.ts`: l'esportazione produce un file valido e aggiorna «ultimo»; l'importazione sostituisce i dati dopo la conferma; un file che non è un backup non tocca niente; il CSV ha intestazioni e importi italiani; sul telefono il backup passa dal foglio di condivisione.

## Fasi di rilascio

1. **Formato, esportazione e importazione** con i test unitari.
2. **Sezione nelle Impostazioni** dopo l'approvazione dei mockup, con l'e2e.
3. **CSV**.

Le tre fasi sono uscite insieme.
