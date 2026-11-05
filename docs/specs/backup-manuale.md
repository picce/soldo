# Backup manuale ed esportazione CSV

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Dalle Impostazioni si esporta un backup completo in JSON, lo si reimporta (anche su un altro dispositivo) e si esportano i movimenti in CSV per un foglio di calcolo.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) e [`mockup-fase-2.md`](./mockup-fase-2.md) (Impostazioni, Importa backup); usata da [`onboarding.md`](./onboarding.md) («Ripristina un backup»); il formato è la base del backup automatico della Fase 3

## Panoramica

Finché non arriva il backup automatico su Google Drive (Fase 3), i dati stanno solo nel telefono: se si perde il telefono o Safari cancella lo storage, si perde tutto. Il backup manuale è la rete di sicurezza della Fase 2 e definisce il formato che la Fase 3 caricherà su Drive.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - sezione «Backup» nelle Impostazioni con «Esporta backup», «Esporta movimenti (CSV)», «Importa backup» e la data dell'ultimo backup («Ultimo backup: 3 giorni fa», oppure «Mai»);
  - backup completo in un file JSON versionato, con tutte le tabelle, anche le righe eliminate (servono alla sincronizzazione futura);
  - sul telefono il file si condivide con il foglio di condivisione (`navigator.share` con i file), così si salva in File, Drive o si manda per email; dove non è possibile, si scarica;
  - importazione: scelta del file, validazione, anteprima (data del file, movimenti, categorie, conti), conferma esplicita perché i dati attuali vengono sostituiti;
  - un file non valido o di una versione futura non tocca i dati e mostra un messaggio chiaro;
  - CSV dei movimenti nella convenzione della lingua: in italiano separatore `;` e importi `1234,56`, in inglese `,` e `1234.56`; codifica UTF-8 con BOM perché Excel legga gli accenti.
- **Non-obiettivi**:
  - unione di un backup con i dati presenti (si sostituisce tutto): la Fase 7 porterà il merge tra dispositivi;
  - cifratura del file (Fase 5);
  - importazione da CSV o da file della banca (Fase 6).

## Design

### Formato

`src/backup/format.ts` (nuovo): schema Zod `backupFileSchema`:

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

Gli schemi dei record riusano i tipi di `src/db/schema.ts`. `src/backup/migrations.ts` (nuovo) porta un file di formato precedente all'attuale; oggi c'è solo il formato 1.

### Esportazione e importazione

- `src/backup/export.ts` (nuovo): `createBackup()` legge tutte le tabelle in una transazione di sola lettura; `deliverFile(blob, name)` usa la condivisione se `navigator.canShare({ files })`, altrimenti un link di download. Nome: `soldo-backup-AAAA-MM-GG.json`. Salva `meta.lastExportAt`.
- `src/backup/import.ts` (nuovo): `readBackup(file)` restituisce l'anteprima o un errore tipizzato (`not-json`, `not-soldo`, `newer-format`, `invalid`); `restoreBackup(backup)` svuota e riempie tutte le tabelle in un'unica transazione Dexie, quindi o riesce tutto o non cambia niente.
- `src/backup/csv.ts` (nuovo): `transactionsToCsv(rows, locale)`; colonne data, tipo, importo (con segno), categoria, conto, nota; virgolette secondo RFC 4180.
- `src/features/settings/BackupSection.vue` e `ImportBackupDialog.vue` (nuovi): sezione e conferma con `VvDialog`.
- Testi in `src/i18n/locales/it.json` ed `en.json`; icone `export`, `download-simple`, `file-arrow-up` in `scripts/build-icons.js`.

### Test

- `src/backup/format.test.ts`, `import.test.ts`: andata e ritorno esporta e reimporta con dati identici; file non JSON, di un'altra app, di formato futuro, con record non validi; transazione annullata se un record fallisce.
- `src/backup/csv.test.ts`: separatori per lingua, virgolette, note con a capo, segni.
- `e2e/backup.spec.ts` (nuovo): l'esportazione produce un file valido; l'importazione di un file di prova sostituisce i dati dopo la conferma.

## Fasi di rilascio

1. **Formato, esportazione e importazione** con i test unitari.
2. **Sezione nelle Impostazioni** dopo l'approvazione dei mockup, con l'e2e.
3. **CSV**.
